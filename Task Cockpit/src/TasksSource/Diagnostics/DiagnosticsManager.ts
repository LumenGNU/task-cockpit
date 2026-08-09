import {
    DiagnosticSeverity,
    EventEmitter,
    languages,
    LogOutputChannel,
    Range,
    workspace
} from 'vscode';
import * as JSONC from 'jsonc-parser';

import { ResourceStateCoordinator } from '../../ResourceState/ResourceStateCoordinator';
import { WindowConfiguration } from '../../WindowConfiguration/WindowConfiguration';
import duplicateLabelCollect from './DuplicateTaskLabel';
import ScopeKey from '../../ScopeKey';
import staleDependenciesCollect from './StaleDependencies';

import type {
    Diagnostic,
    DiagnosticCollection,
    Disposable,
    Event,
    Uri
} from 'vscode';
import type Config from '../../WindowConfiguration/Config';
import type Immutable from '../../utils/Immutable';
import type Safe from '../../utils/Safe';


const CONFIGURATION_KEY = 'Validation';
type ValidationConf = Config[typeof CONFIGURATION_KEY];

interface ScopedSource {
    readonly scopeKey: ScopeKey;
    readonly isPrimaFolder?: boolean;
    readonly uri: Uri;
    readonly JSONPath: ReadonlyArray<string>;
}

declare const ___UpdatingPhaseId: unique symbol;
type UpdatingPhaseId = number & { readonly [___UpdatingPhaseId]: never; };

type ReadonlyDiagnosticCollection = Omit<DiagnosticCollection, 'dispose' | 'clear' | 'delete' | 'set'>;

class DiagnosticsManager implements Disposable {

    readonly #onDidCollect: EventEmitter<void>;
    public readonly onDidCollect: Event<void>;

    readonly #diagnosticCollection: DiagnosticCollection;

    readonly #windowConfiguration: Safe<WindowConfiguration>;
    readonly #stateCoordinator: Safe<ResourceStateCoordinator>;
    readonly #logOutputChannel: Safe<LogOutputChannel> | null;

    #debounceTimer: NodeJS.Timeout | null;
    #debounceDelay: number;

    #conf: ValidationConf;
    #phase: 'disposed' | UpdatingPhaseId;
    #disposables: Disposable[] = [];

    constructor(
        collectionName: string | undefined, // 'Task Cockpit'
        windowConfiguration: Safe<WindowConfiguration>,
        stateCoordinator: Safe<ResourceStateCoordinator>,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {

        this.#windowConfiguration = windowConfiguration;
        this.#stateCoordinator = stateCoordinator;
        this.#logOutputChannel = logOutputChannel;

        this.#diagnosticCollection = languages.createDiagnosticCollection(collectionName);

        this.#onDidCollect = new EventEmitter();
        this.onDidCollect = this.#onDidCollect.event;

        this.#disposables.push(

            this.#windowConfiguration.onDidChange((affectedKeys) => {
                if (affectedKeys.has(CONFIGURATION_KEY)) {
                    this.#conf = this.#windowConfiguration.getConfig(CONFIGURATION_KEY);
                    this.#scheduleUpdate();
                }
            }),

            this.#stateCoordinator.onDidChange((affectedKeys) => {
                if (affectedKeys.has('TASKS')) {
                    this.#scheduleUpdate();
                }
            }),

            this.#diagnosticCollection,
            this.#onDidCollect
        );

        this.#debounceDelay = 50;
        this.#debounceTimer = null;

        this.#conf = this.#windowConfiguration.getConfig(CONFIGURATION_KEY);
        this.#phase = this.#nextPhaseId();
        this.#scheduleUpdate();
    }

    dispose() {

        if (this.#phase === 'disposed') {
            return;
        }
        this.#phase = 'disposed';

        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }

        for (const sub of this.#disposables) {
            sub.dispose();
        }

        this.#logOutputChannel?.trace(`${this.constructor.name}: disposed`);
    }


    public get diagnosticCollection(): Immutable<ReadonlyDiagnosticCollection> {
        return this.#diagnosticCollection;
    }


    #scheduleUpdate(): void {

        if (this.#phase === 'disposed') {
            return;
        }

        // Перезапускаем таймер
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }

        this.#debounceTimer = setTimeout(() => {
            this.#updateDiagnostics();
        }, this.#debounceDelay);
    }


    #updateDiagnostics() {

        if (this.#phase === 'disposed' || this.#stateCoordinator.disposed) {
            return;
        }

        const scopeLayout = this.#stateCoordinator.getScopeLayout();

        const scopedSources: ScopedSource[] = [];

        // if (scopeLayout[ScopeKey.GLOBAL_KEY]?.taskSource) {
        // сейчас всегда null
        // }

        if (scopeLayout[ScopeKey.WORKSPACE_KEY]?.taskSource) {
            const { uri, JSONPath } = scopeLayout[ScopeKey.WORKSPACE_KEY]!.taskSource!;
            scopedSources.push({
                scopeKey: ScopeKey.WORKSPACE_KEY,
                uri,
                JSONPath
            });
        }

        if (scopeLayout.folders) {
            for (const key of Object.keys(scopeLayout.folders) as ScopeKey.FolderKey[]) {
                const { index, taskSource: { uri, JSONPath } } = scopeLayout.folders[key]!;
                scopedSources.push({
                    scopeKey: key,
                    uri,
                    JSONPath,
                    isPrimaFolder: index === 0
                });
            }
        }

        this.#deleteStaleDiagnostics(scopedSources);

        void this.#collectDiagnostics(scopedSources);

    }


    async #collectDiagnostics(scopedSources: Immutable<Array<ScopedSource>>): Promise<void> {

        if (this.#phase === 'disposed') {
            return;
        }

        const capturedPhase = this.#phase = this.#nextPhaseId();

        const scopedDiagnostics = await Promise.all(scopedSources.map(async (source) => {
            const uri = source.uri;
            try {
                const document = await workspace.openTextDocument(uri);

                if (capturedPhase !== this.#phase) {
                    return { uri, diagnostics: [] };
                }

                const jsoncTree = JSONC.parseTree(document.getText(), undefined, {
                    allowEmptyContent: true,
                    allowTrailingComma: true
                });

                if (!jsoncTree) {
                    return { uri, diagnostics: [] };
                }

                const taskNodes = extractTaskNodes(jsoncTree, [...source.JSONPath]);

                if (!taskNodes) {
                    return { uri, diagnostics: [] };
                }

                const diagnostics = [
                    ...this.#conf.duplicates
                        ? duplicateLabelCollect(taskNodes)
                        : [],
                    ...this.#conf.dependencies
                        ? staleDependenciesCollect(taskNodes, this.#buildAvailableNames(source))
                        : []
                ].map((rawDiagnostic) => {
                    return {
                        message: rawDiagnostic.message,
                        range: new Range(document.positionAt(rawDiagnostic.position.offset), document.positionAt(rawDiagnostic.position.offset + rawDiagnostic.position.length)),
                        severity: DiagnosticSeverity.Warning,
                        source: 'task-cockpit',
                        code: rawDiagnostic.code
                    } satisfies Diagnostic;
                });

                return { uri, diagnostics };

            }
            catch {
                return { uri, diagnostics: [] };
            }
        }));

        if (capturedPhase !== this.#phase) {
            return;
        }

        scopedDiagnostics.forEach((scopedDiagnostic) => {
            this.#diagnosticCollection.set(scopedDiagnostic.uri, scopedDiagnostic.diagnostics);
        });

        this.#onDidCollect.fire();
    }


    #deleteStaleDiagnostics(scopedSources: Immutable<Array<ScopedSource>>): void {

        if (this.#phase === 'disposed') {
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

    #buildAvailableNames(source: {
        readonly scopeKey: ScopeKey;
        readonly isPrimaFolder?: boolean | undefined;
    }): { has(key: string): boolean; } {

        if (this.#phase === 'disposed' || this.#stateCoordinator.disposed) {
            return new Set();
        }

        // Первая папка воркспейса (index === 0): видит задачи global + workspace + свои.
        // Поведение подтверждено тестами, но официальной документации мной не найдено.
        if (source.isPrimaFolder) {
            return new Set(
                [
                    ...(this.#stateCoordinator.getTaskDefinitions(ScopeKey.GLOBAL_KEY)?.keys() ?? []),
                    ...(this.#stateCoordinator.getTaskDefinitions(ScopeKey.WORKSPACE_KEY)?.keys() ?? []),
                    ...(this.#stateCoordinator.getTaskDefinitions(source.scopeKey)?.keys() ?? [])
                ]
            );
        }

        return new Set(this.#stateCoordinator.getTaskDefinitions(source.scopeKey)?.keys() ?? []);
    }

    #nextPhaseId = (function (increment: number) {
        return function () {
            return ++increment as UpdatingPhaseId;
        };
    })(0);

}


function extractTaskNodes(jsoncTree: JSONC.Node, JSONPath: Array<string>): Array<JSONC.Node> | null {

    const tasksArrayNode = jsoncTree
        ? JSONC.findNodeAtLocation(jsoncTree, JSONPath)
        : null;

    if (!tasksArrayNode || tasksArrayNode.type !== 'array' || !tasksArrayNode.children) {
        return null;
    }

    return tasksArrayNode.children;
}


export default DiagnosticsManager;
