/** @file TreeViewPanel/TreeView/TreeView.ts */

import {
    commands,
    window
} from 'vscode';
import AsyncQueue from '../../utils/AsyncQueue';
import ResourceStateCoordinator from '../../ResourceStateCoordinator/ResourceStateCoordinator';
import TaskTreeDataProvider from './TaskTreeDataProvider';

import type {
    Disposable,
    LogOutputChannel,
    TreeDataProvider,
    TreeView as VscTreeView
} from 'vscode';
import type Immutable from '../../utils/Immutable';
import type LifecycleOmitted from '../../utils/LifecycleOmitted';
import type OriginKey from '../../OriginKey';
import type OriginNode from '../OriginNode';
import type Runtime from '../../Runtime/Runtime';
import type TaskName from '../../TaskName';


class TreeView implements Disposable {

    readonly #treeDataProvider: TaskTreeDataProvider;
    readonly #treeView: VscTreeView<Immutable<unknown>>;

    readonly #viewId: string;

    #excludedScopesCount: number | null;

    #disposed: boolean;
    readonly #disposables: Disposable[];

    readonly #asyncQueue: AsyncQueue;
    #logOutputChannel: LifecycleOmitted<LogOutputChannel> | null;

    readonly #dependencies: Readonly<{
        resourceStateCoordinator: LifecycleOmitted<ResourceStateCoordinator>;
        processRegistry: Runtime.ProcessRegistryView;
    }>;

    constructor(
        viewId: string,
        title: string,
        dependencies: Readonly<{
            resourceStateCoordinator: LifecycleOmitted<ResourceStateCoordinator>;
            processRegistry: Runtime.ProcessRegistryView;
        }>,
        logOutputChannel: LifecycleOmitted<LogOutputChannel> | null = null
    ) {

        this.#disposed = false;

        this.#logOutputChannel = logOutputChannel;
        this.#asyncQueue = AsyncQueue.create(this.#logOutputChannel);

        this.#dependencies = dependencies;

        this.#treeDataProvider = new TaskTreeDataProvider(this.#dependencies, this.#logOutputChannel);

        this.#viewId = viewId;

        this.#treeView = window.createTreeView(
            this.#viewId,
            {
                treeDataProvider: this.#treeDataProvider as TreeDataProvider<Immutable<unknown>>,
                canSelectMany: false,
                dragAndDropController: undefined,
                manageCheckboxStateManually: undefined
            }
        );

        this.#treeView.title = title;
        this.#treeView.description = undefined;

        this.#excludedScopesCount = null;

        this.#disposables = [
            this.#treeView,
            this.#treeDataProvider
        ];

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.#treeDataProvider.onDidRefreshTopElements(this.#updateTopElementsHandler, this, this.#disposables);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.#dependencies.processRegistry.onDidChangeTaskProcesses(this.#changeTaskProcessesHandler, this, this.#disposables);
    }

    public dispose() {

        if (this.#disposed) { return; }
        this.#disposed = true;

        this.#disposables.forEach((d) => void d.dispose());

        void this.#asyncQueue.enqueue(
            () => commands.executeCommand<void>('setContext', `${this.#viewId}.hasItems`, undefined)
        );

        this.#logOutputChannel?.trace(`[${this.constructor.name}] disposed`);
        this.#logOutputChannel = null;
    }

    // #region Handlers

    #updateTopElementsHandler() {

        if (this.#disposed) { return; }

        const visibleScopesCount = this.#treeDataProvider.topElements?.length ?? null;
        this.#treeView.description = buildViewDescription(visibleScopesCount, this.#excludedScopesCount);

        void this.#asyncQueue.enqueue(
            () => commands.executeCommand<void>('setContext', `${this.#viewId}.hasItems`, Boolean(visibleScopesCount))
        );
    }


    #changeTaskProcessesHandler(affectedTasks: Immutable<Map<OriginKey, Set<TaskName>>>) {

        if (this.#disposed) { return; }

        // @todo - знать originKeys содержимого, и отбрасывать сразу не валидное?
        // не делать for, не вызывать updateRunnable - если все равно будет промах
        for (const [originKey, taskNames] of affectedTasks) {
            for (const taskName of taskNames) {
                this.#treeDataProvider.notifyRunnableChanged(originKey, taskName);
            }
        }
    }

    // #endregion

    public rebuild(originTree: Immutable<Array<OriginNode>>, excludedScopesCount: number | null = null): void {
        if (this.#isInoperable) { return; }

        this.#excludedScopesCount = excludedScopesCount;
        this.#treeDataProvider.rebuild(originTree);
    }


    public expandAll() {

        if (this.#isInoperable) { return; }

        const topElements = this.#treeDataProvider.topElements;
        if (!topElements || topElements.length < 1) {
            return;
        }

        for (const element of topElements) {
            void this.#treeView.reveal(element, {
                expand: 3,
                focus: false,
                select: false
            })
                .then(undefined, (err) => {
                    this.#logOutputChannel?.trace(`[${this.constructor.name}#expandAll] reveal skipped: ${err}.`);
                });
        }

    }


    public collapseAll() {

        if (this.#isInoperable) { return; }

        // не документирована. проверено работает 1.86.2-1.131.0
        void commands.executeCommand(
            `workbench.actions.treeView.${this.#viewId}.collapseAll` // @remark так вот почему в ID запрещена точка?
        )
            .then(undefined, (err) => {
                this.#logOutputChannel?.trace(`[${this.constructor.name}#collapseAll] collapse skipped: ${err}.`);
            });
    }


    get #isInoperable(): boolean {

        if (this.#disposed) { return true; }

        const dependenciesDisposed =
            this.#dependencies.resourceStateCoordinator.disposed ||
            this.#dependencies.processRegistry.disposed;

        if (dependenciesDisposed) {
            // warn намеренно: сигнал о нарушении порядка dispose.
            this.#logOutputChannel?.warn(`[${this.constructor.name}] External dependencies are disposed`);
            return true;
        }

        return false;
    }
}

// есть если нет исключённых скоупов, описание не показывается
// вовсе — тек задумано: ничего не сообщаем, если сообщать нечего.
// viewsWelcome из package.json уже объясняет
// "все скоупы скрыты" — "0/5" в description избыточно.
function buildViewDescription(visibleScopesCount: number | null, excludedScopesCount: number | null): string | undefined {

    if (!visibleScopesCount || !excludedScopesCount) {
        return undefined;
    }
    const total = visibleScopesCount + excludedScopesCount;
    return `${visibleScopesCount}/${total}`;
}


export default TreeView;
