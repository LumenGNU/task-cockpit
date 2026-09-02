/** @file TreeViewPanel/TreeViewPanel.ts */

import {
    commands
} from 'vscode';
import * as timers from 'timers/promises';
import AsyncQueue from '../utils/AsyncQueue';
import ResourceStateCoordinator from '../ResourceStateCoordinator/ResourceStateCoordinator';
import TreeView from './TreeView/TreeView';
import WindowSettings from '../WindowSettings/WindowSettings';
import {
    CONTAINER,
    PROJECT_TREE,
    USER_TREE
} from '../common';
import * as assert from 'node:assert/strict';
import OriginNode from './OriginNode';

import type {
    Disposable,
    LogOutputChannel
} from 'vscode';
import type Immutable from '../utils/Immutable';
import type LifecycleOmitted from '../utils/LifecycleOmitted';
import type OriginEntry from '../ResourceStateCoordinator/OriginEntry';
import type TaskProcessLifecycle from '../Runtime/TaskProcessLifecycle';
import type Element from './TreeView/Element/Element';


type TreeViewId =
    | typeof USER_TREE.ID
    | typeof PROJECT_TREE.ID;

class TreeViewPanel implements Disposable {

    readonly #globalTreeView: TreeView;
    readonly #projectTreeView: TreeView;

    // readonly #containerId = CONTAINER.ID;

    // тротлинг между onDidChange’сами
    static readonly #throttleDelay: number = 25;
    // ------------------------------

    readonly #disposables: Disposable[];
    #disposed: boolean;

    readonly #asyncQueue: AsyncQueue;

    #updatePending: boolean;

    #logOutputChannel: LifecycleOmitted<LogOutputChannel> | null;

    readonly #resourceProps: Readonly<{
        windowSettings: LifecycleOmitted<WindowSettings>;
        resourceStateCoordinator: LifecycleOmitted<ResourceStateCoordinator>;
    }>;

    constructor(
        resourceProps: Readonly<{
            windowSettings: LifecycleOmitted<WindowSettings>;
            resourceStateCoordinator: LifecycleOmitted<ResourceStateCoordinator>;
        }>,
        taskProcessRegistry: TaskProcessLifecycle.TaskProcessRegistryView,
        logOutputChannel: LifecycleOmitted<LogOutputChannel> | null = null
    ) {

        this.#disposed = false;

        this.#resourceProps = resourceProps;
        this.#logOutputChannel = logOutputChannel;

        this.#asyncQueue = AsyncQueue.create(this.#logOutputChannel);

        this.#globalTreeView = new TreeView(
            USER_TREE.ID,
            USER_TREE.NAME,
            this.#resourceProps,
            taskProcessRegistry,
            this.#logOutputChannel
        );

        this.#projectTreeView = new TreeView(
            PROJECT_TREE.ID,
            PROJECT_TREE.NAME,
            this.#resourceProps,
            taskProcessRegistry,
            this.#logOutputChannel
        );

        this.#disposables = [
            this.#globalTreeView,
            this.#projectTreeView
        ];

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.#resourceProps.resourceStateCoordinator.onDidStateChange(this.#resourceStateChangeHandler, this, this.#disposables);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.#resourceProps.windowSettings.onDidChangeConfiguration(this.#changeConfigurationHandler, this, this.#disposables);

        this.#updatePending = false;
        void this.#asyncQueue.enqueue(async () => {
            if (this.isInoperable) { return; }
            await commands.executeCommand('setContext', CONTAINER.WHEN.ACTIVE, false);
            if (this.isInoperable) { return; }
            await this.#updateFromProjectState();
        });

    }


    public dispose() {

        if (this.#disposed) { return; }
        this.#disposed = true;

        this.#disposables.forEach((d) => void d.dispose());

        void this.#asyncQueue.enqueue(async () => {
            await commands.executeCommand<void>('setContext', CONTAINER.WHEN.ACTIVE, undefined);
        });

        this.#logOutputChannel?.trace(`[${this.constructor.name}] disposed`);
        this.#logOutputChannel = null;
    }


    // #region Handlers

    #resourceStateChangeHandler() {
        if (this.isInoperable) { return; }
        this.#requestUpdate();
    }

    #changeConfigurationHandler(affectedKeys: Immutable<WindowSettings.AffectedKeys>) {
        if (this.isInoperable) { return; }
        if (affectedKeys.has('Filtering')) {
            this.#requestUpdate();
        }
    }

    // #endregion


    public expandAllInView(viewId: TreeViewId) {

        if (this.isInoperable) { return; };

        if (viewId === USER_TREE.ID) {
            this.#globalTreeView.expandAll();
        }
        else if (viewId === PROJECT_TREE.ID) {
            this.#projectTreeView.expandAll();
        }
    }


    public collapseAllInView(viewId: TreeViewId) {

        if (this.isInoperable) { return; };

        if (viewId === USER_TREE.ID) {
            this.#globalTreeView.collapseAll();
        }
        else if (viewId === PROJECT_TREE.ID) {
            this.#projectTreeView.collapseAll();
        }
    }

    public async forceFullRefresh() {

        if (this.isInoperable) { return; };

        // @todo если после этого вызова прошло, скажем, 15 сек, но onDidStateChange
        // так и не случился: выбросить ошибку + setContext ACTIVE -> true
        void this.#asyncQueue.enqueue(async () => {
            await commands.executeCommand<void>('setContext', CONTAINER.WHEN.ACTIVE, false);
        });
        return await this.#resourceProps.resourceStateCoordinator.forceFullRefresh();
    }


    public getSelection(viewId: TreeViewId): Immutable<Element> | undefined {

        if (this.isInoperable) { return undefined; };

        if (viewId === USER_TREE.ID) {
            return this.#globalTreeView.getSelection();
        }
        else if (viewId === PROJECT_TREE.ID) {
            return this.#projectTreeView.getSelection();
        }
        return undefined;
    }


    // Coalesce: в очереди не больше одного pending-update одновременно.
    // #updatePending сбрасывается до getScopeEntries — чтобы новый onDidChange
    // мог вытеснить текущий цикл: #updateFromProjectState увидит флаг и выйдет досрочно.
    #requestUpdate(): void {

        if (this.isInoperable) { return; }

        if (this.#updatePending) { return; }
        this.#updatePending = true;

        void this.#asyncQueue.enqueue(async () => {
            if (this.isInoperable) { return; }
            await commands.executeCommand<void>('setContext', CONTAINER.WHEN.ACTIVE, false);
            if (this.isInoperable) { return; }
            await timers.setTimeout(TreeViewPanel.#throttleDelay);
            if (this.isInoperable) { return; }

            // #updatePending при раннем выходе не сбрасывается намеренно:
            // неработоспособный Panel не возобновляет работу, флаг нерелевантен.
            this.#updatePending = false;

            await this.#updateFromProjectState();
        });

    }

    async #updateFromProjectState() {

        if (this.isInoperable) { return; }
        // Вытесненный цикл не выставляет PANEL_ACTIVE=true намеренно:
        // TreeView не обновлён, Panel не готова к взаимодействию.
        // Следующий цикл из очереди сделает полный update с актуальными данными.
        if (this.#updatePending) { return; }

        const originEntries = await this.#resourceProps.resourceStateCoordinator.getOriginEntries();

        if (this.isInoperable) { return; }
        if (this.#updatePending) { return; }

        this.#globalTreeView.rebuild([OriginNode.build(originEntries.User)]);

        const excluded = this.#resourceProps.windowSettings.getConfiguration('Filtering').excludeFolders;
        let excludedScopesCount = 0;

        const projectOrigins =
            originEntries.Workspace
                ? [originEntries.Workspace, ...originEntries.folders]
                : originEntries.folders;

        const filteredOrigins =
            excluded.size < 1
                ? projectOrigins
                : projectOrigins.reduce((acc, originEntry) => {
                    if (excluded.has(originEntry.name)) {
                        ++excludedScopesCount;
                    }
                    else {
                        acc.push(originEntry);
                    }
                    return acc;
                }, [] as Immutable<OriginEntry>[]);


        this.#projectTreeView.rebuild(
            filteredOrigins.map((originEntry) => OriginNode.build(originEntry)),
            excludedScopesCount
        );

        await commands.executeCommand<void>('setContext', CONTAINER.WHEN.ACTIVE, true);
    }


    get isInoperable(): boolean {

        if (this.#disposed) {
            return true;
        }

        const dependenciesDisposed =
            this.#resourceProps.resourceStateCoordinator.disposed ||
            this.#resourceProps.windowSettings.disposed;

        if (dependenciesDisposed) {
            // warn намеренно: сигнал о нарушении порядка dispose.
            this.#logOutputChannel?.warn(`[${this.constructor.name}] External dependencies are disposed`);
            return true;
        }

        return false;
    }

}


export default TreeViewPanel;
