import {
    CancellationError,
    CancellationTokenSource,
    languages,
    Range,
    type CancellationToken,
    type DiagnosticCollection,
    type Disposable,
    type TextDocument,
    type Uri,
    workspace,
    LogOutputChannel,
} from 'vscode';
import * as JSONC from 'jsonc-parser';
import configurationProvider from '../../Configuration/ConfigurationProvider';
import duplicateLabelCollect from './DuplicateTaskLabel';
import getScopes from '../../Scope/getScopes';
import resolveTaskSource from '../resolveTaskSource';
import staleDependenciesCollect from './StaleDependencies';
import type SourceUri from '../SourceUri';
import Config from '../../Configuration/Window/Config';
import Scope from '../../Scope/Scope';
import isFolder from '../../Scope/isFolder';
import TaskDefinitions from '../../Configuration/TaskDefinitions';
import WorkspaceScope from '../../Scope/Workspace/Workspace';
import GlobalScope from '../../Scope/Global/Global';


const CONFIGURATION_KEY = 'ValidationConf';
type ValidationConf = Config[typeof CONFIGURATION_KEY];

interface ScopedSource {
    readonly scope: Scope;
    readonly uri: SourceUri;
    readonly JSONPath: ReadonlyArray<string>;
}

type RangeMapper = (range: { start: number; end: number; }) => Range;

interface ParsedSource {
    readonly uri: SourceUri;
    readonly data: {
        readonly scope: Scope;
        readonly taskNodes: readonly Readonly<JSONC.Node>[];
        readonly rangeMapper: RangeMapper;
    } | null;
};


class DiagnosticsManager implements Disposable {

    #cts: CancellationTokenSource | null;

    readonly #diagnosticCollection: DiagnosticCollection;

    #subscriptions: Disposable[] = [];

    #disposed: boolean;

    readonly #logOutputChannel: LogOutputChannel | null;

    readonly #configurationProvider;

    #conf: ValidationConf;

    constructor(
        configurationProvider: configurationProvider,
        logOutputChannel: LogOutputChannel | null = null
    ) {

        this.#disposed = false;

        this.#logOutputChannel = logOutputChannel;

        this.#cts = null;

        this.#diagnosticCollection = languages.createDiagnosticCollection('Task Cockpit');

        this.#configurationProvider = configurationProvider;

        this.#subscriptions.push(

            this.#configurationProvider.onDidChange((affectedKeys) => {

                const isConfChanged = affectedKeys.has('ValidationConf');
                const isTasksChanged = affectedKeys.has('TASKS');

                if (isConfChanged) {
                    this.#conf = this.#configurationProvider.readWindowConfig(CONFIGURATION_KEY);
                }

                if (isConfChanged || isTasksChanged) {
                    void this.#scheduleUpdate();
                }
            }),

            workspace.onDidChangeWorkspaceFolders(() => {
                void this.#scheduleUpdate();
            })
        );

        this.#conf = this.#configurationProvider.readWindowConfig(CONFIGURATION_KEY);
        void this.#scheduleUpdate();
    }

    dispose() {

        if (this.#disposed) {
            return;
        }
        this.#disposed = true;

        this.#cts?.cancel();
        this.#cts?.dispose();
        this.#cts = null;

        this.#diagnosticCollection.dispose();
        for (const sub of this.#subscriptions) {
            sub.dispose();
        }
    }

    async #scheduleUpdate(): Promise<void> {

        if (this.#disposed) {
            return;
        }

        this.#cts?.cancel();
        this.#cts?.dispose();
        const cts = new CancellationTokenSource();
        this.#cts = cts;

        try {
            await delay(210, cts.token);
            await this.#setDiagnostics(cts.token);
        } catch (error) {
            if (!(error instanceof CancellationError)) {
                if (this.#logOutputChannel) {
                    this.#logOutputChannel.error('DiagnosticsManager. Unexpected error:', error);
                }
            }
        } finally {
            if (this.#cts === cts) {
                this.#cts = null;
                cts.dispose();
            }
        }
    }

    /**
     * @throws { CancellationError }
    * */
    async #setDiagnostics(token: CancellationToken): Promise<void> {

        if (this.#disposed) {
            return;
        }

        if (token.isCancellationRequested) {
            throw new CancellationError();
        }

        const scopedSources = (await Promise.all(
            getScopes().map(async (scope) => {

                const taskSource = await resolveTaskSource(scope);

                if (token.isCancellationRequested) {
                    throw new CancellationError();
                }

                return taskSource
                    ? { ...taskSource, scope } as const
                    : null;
            })
        )).filter((s) => s != null);

        if (token.isCancellationRequested) {
            throw new CancellationError();
        }

        if (this.#disposed) {
            return;
        }

        this.#deleteStaleDiagnostics(scopedSources);

        // @throws { CancellationError }
        const parsedSources = await Promise.all(scopedSources.map((source) => parseSource(source, token)));

        if (token.isCancellationRequested) {
            throw new CancellationError();
        }

        if (this.#disposed) {
            return;
        }

        this.#diagnosticCollection.set(

            parsedSources.map((source) => {
                const { uri, data } = source;

                if (!data) {
                    return [uri, undefined];
                }

                const { taskNodes, scope, rangeMapper } = data;

                const duplicateLabelCollection =
                    this.#conf.duplicates
                        ? duplicateLabelCollect(taskNodes, rangeMapper)
                        : [];

                const staleDependenciesCollection =
                    this.#conf.dependencies
                        ? staleDependenciesCollect(
                            taskNodes,
                            isFolder(scope) && scope.index === 0
                                ? new Set([
                                    ...TaskDefinitions.buildAvailableNames(GlobalScope),
                                    ...TaskDefinitions.buildAvailableNames(WorkspaceScope),
                                    ...TaskDefinitions.buildAvailableNames(scope),
                                ])
                                : TaskDefinitions.buildAvailableNames(scope),
                            rangeMapper
                        )
                        : [];

                return [uri, [
                    ...duplicateLabelCollection,
                    ...staleDependenciesCollection
                ]] as const;
            })
        );

        // #region DEBUG
        this.printCurrentDiagnostics();
        // #endregion DEBUG
    }


    #deleteStaleDiagnostics(scopedSources: ReadonlyArray<Readonly<ScopedSource>>): void {

        if (this.#disposed) {
            return;
        }

        const activeUris = new Set(scopedSources.map((s) => s.uri.toString()));
        const toDelete: Uri[] = [];
        this.#diagnosticCollection.forEach((uri) => {
            if (!activeUris.has(uri.toString())) {
                toDelete.push(uri);

            }
        });
        for (const uri of toDelete) {
            this.#diagnosticCollection.delete(uri);
        }
    }


    // #region DEBUG

    printCurrentDiagnostics() {

        if (!this.#logOutputChannel) {
            return;
        }

        this.#logOutputChannel.appendLine('Diagnostics:');

        const lines: string[] = [];

        this.#diagnosticCollection.forEach((uri, diagnostics) => {
            lines.push(workspace.asRelativePath(uri));
            diagnostics.forEach((diagnostic) => {
                lines.push(` - (${['err', 'warn', 'info', 'hint'].at(diagnostic.severity)}) ${diagnostic.message}`);
            });
        });

        if (lines.length < 1) {
            this.#logOutputChannel.appendLine('currently No diagnostics');
            return;
        }

        lines.forEach((l) => {
            this.#logOutputChannel!.appendLine(l);
        });
    }

    // #endregion DEBUG
}


async function parseSource(source: ScopedSource, token: CancellationToken): Promise<ParsedSource> {

    let document: TextDocument;

    try {
        document = await workspace.openTextDocument(source.uri);
    }
    catch {
        return {
            uri: source.uri,
            data: null
        };
    }

    if (token.isCancellationRequested) {
        throw new CancellationError();
    }

    const jsoncTree = JSONC.parseTree(document.getText(), undefined, {
        allowEmptyContent: true,
        allowTrailingComma: true
    });

    const tasksArrayNode = jsoncTree
        ? JSONC.findNodeAtLocation(jsoncTree, [...source.JSONPath])
        : null;

    if (!tasksArrayNode || tasksArrayNode.type !== 'array' || !tasksArrayNode.children) {
        return {
            uri: source.uri,
            data: null
        };
    }

    return {
        uri: source.uri,
        data: {
            scope: source.scope,
            taskNodes: tasksArrayNode.children,
            rangeMapper: (range) =>
                new Range(document.positionAt(range.start), document.positionAt(range.end))
        }
    };
}


function delay(ms: number, token: CancellationToken): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (token.isCancellationRequested) {
            reject(new CancellationError());
            return;
        }
        const timeout = setTimeout(resolve, ms);
        const sub = token.onCancellationRequested(() => {
            clearTimeout(timeout);
            sub.dispose();
            reject(new CancellationError());
        });
    });
}


export default DiagnosticsManager;
