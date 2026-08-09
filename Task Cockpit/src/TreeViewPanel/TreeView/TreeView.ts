import {
    window,
    LogOutputChannel,
    TreeView as VscTreeView,
    TreeDataProvider as VscTreeDataProvider,
    commands,
    type Disposable
} from 'vscode';
import * as assert from 'node:assert/strict';
import { ResourceStateCoordinator } from '../../ResourceState/ResourceStateCoordinator';
import TreeDataProvider from './TreeDataProvider';
// import type RuntimeRegistry from '../../Runtime/RuntimeRegistry';
import type Safe from '../../utils/Safe';
import type ScopeData from '../ScopeData';
// import type TaskIdentifier from '../../Runtime/TaskIdentifier';
import Element from './Element/Element';
import type ScopeKey from '../../ScopeKey';
import type TaskName from '../../TaskName';
import AsyncQueue from '../../utils/AsyncQueue';
import type Immutable from 'src/utils/Immutable';


class TreeView implements Disposable {

    readonly #stateCoordinator: Safe<ResourceStateCoordinator>;
    // readonly #runtimeRegistry: RuntimeRegistry;
    #logOutputChannel: Safe<LogOutputChannel> | null;

    readonly #treeDataProvider: TreeDataProvider;
    readonly #treeView: VscTreeView<Immutable<Element>>;

    readonly #viewId: string;

    #excludedScopesCount: number | null;

    readonly #asyncQueue: AsyncQueue;

    constructor(
        viewId: string,
        projectStateCoordinator: Safe<ResourceStateCoordinator>,
        // runtimeRegistry: RuntimeRegistry,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {

        this.#stateCoordinator = projectStateCoordinator;
        // this.#runtimeRegistry = runtimeRegistry;
        this.#logOutputChannel = logOutputChannel;

        this.#asyncQueue = AsyncQueue.create();


        this.#treeDataProvider = new TreeDataProvider(
            this.#stateCoordinator,
            // this.#runtimeRegistry,
            this.#logOutputChannel
        );

        this.#viewId = viewId;

        this.#treeView = window.createTreeView(
            this.#viewId,
            {
                treeDataProvider: this.#treeDataProvider as VscTreeDataProvider<Immutable<Element>>,
                canSelectMany: false,
                dragAndDropController: undefined,
                manageCheckboxStateManually: undefined,
                showCollapseAll: true // #todo
            }
        );

        this.#treeView.description = undefined;
        this.#excludedScopesCount = null;
        void this.#setIsEmptyContext(true);
        void this.#setInUpdatingContext(true);

        // @fixme dispose
        this.#treeDataProvider.onStartUpdate(() => {
            void this.#setInUpdatingContext(true);
        });

        // @fixme dispose
        this.#treeDataProvider.onBeenUpdated(() => {

            const visibleScopesCount = this.#treeDataProvider.topElements?.length ?? null;
            this.#treeView.description = buildViewDescription(visibleScopesCount, this.#excludedScopesCount);

            void this.#setIsEmptyContext(!Boolean(visibleScopesCount));
            void this.#setInUpdatingContext(false);
        });

    }

    public dispose() {
        // @fixme

        this.#logOutputChannel?.trace(`${this.constructor.name}: disposed`);
        this.#logOutputChannel = null;
    }

    updateRunnable(taskIdentifier: { scopeKey: ScopeKey, taskName: TaskName; }) {
        this.#treeDataProvider.updateRunnable(taskIdentifier);
    }


    fullUpdate(scopesData: Immutable<Array<ScopeData>>, excludedScopesCount: number | null = null) {
        this.#excludedScopesCount = excludedScopesCount;
        this.#treeDataProvider.fullUpdate(scopesData);
    }


    public expandAll() {
        const topElements = this.#treeDataProvider.topElements;
        if (!topElements || topElements.length < 1) {
            return;
        }
        topElements.forEach(e => void this.#treeView.reveal(e, {
            expand: 3,
            focus: false,
            select: false
        }));
    }


    // #region #setIs**Context

    async #setIsEmptyContext(isEmpty: boolean) {
        return this.#asyncQueue.enqueue(() => commands.executeCommand<void>('setContext', `task-cockpit.${this.#viewId}.isEmpty`, isEmpty));
    }

    async #setInUpdatingContext(inUpdating: boolean) {
        return this.#asyncQueue.enqueue(() => commands.executeCommand<void>('setContext', `task-cockpit.${this.#viewId}.inUpdating`, inUpdating));
    }

    // #endregion

}


function buildViewDescription(visibleScopesCount: number | null, excludedScopesCount: number | null): string | undefined {

    if (!visibleScopesCount || !excludedScopesCount) {
        return undefined;
    }
    const total = visibleScopesCount + excludedScopesCount;
    return `${visibleScopesCount}/${total}`;
}


export default TreeView;
