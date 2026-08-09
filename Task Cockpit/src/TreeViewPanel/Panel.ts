
import {
    commands,
    LogOutputChannel,
    type Disposable
} from 'vscode';
import * as assert from 'node:assert/strict';
import type Safe from '../utils/Safe';
import { ResourceStateCoordinator } from '../ResourceState/ResourceStateCoordinator';
import ScopeData from './ScopeData';
import HierarchyModel from '../HierarchyModel/HierarchyModel';
import Splitter from '../Splitter';
import TaskName from '../TaskName';
// import Runtime from '../Runtime/Runtime';
import Config from '../ResourceState/ResourceConfig/Config';
import TaskDefinition from '../ResourceState/TaskDefinition/TaskDefinition';
import TreeView from './TreeView/TreeView';
import WindowConfiguration from '../WindowConfiguration/WindowConfiguration';
import AsyncQueue from '../utils/AsyncQueue';
import ScopeKey from '../ScopeKey';
import type Immutable from '../utils/Immutable';
import type Scope from '../ResourceState/Scope';

type ViewContainerId = 'task-cockpit_view-container';
type GlobalTreeViewId = `${ViewContainerId}_global-task-view`;
type WorkspaceTreeViewId = `${ViewContainerId}_workspace-task-view`;

export const VIEW_CONTAINER_ID = 'task-cockpit_view-container' satisfies ViewContainerId;
export const GLOBAL_TREE_VIEW_ID = `${VIEW_CONTAINER_ID}_global-task-view` satisfies GlobalTreeViewId;
export const WORKSPACE_TREE_VIEW_ID = `${VIEW_CONTAINER_ID}_workspace-task-view` satisfies WorkspaceTreeViewId;

type TreeViewId =
    | GlobalTreeViewId
    | WorkspaceTreeViewId
    ;

class Panel implements Disposable {


    readonly #stateCoordinator: Safe<ResourceStateCoordinator>;
    #logOutputChannel: Safe<LogOutputChannel> | null;


    readonly #globalTreeView: TreeView;
    readonly #workspaceTreeView: TreeView;


    // readonly #runtime: Safe<Runtime>;

    readonly #windowConfiguration: Safe<WindowConfiguration>;

    // Защита от дребезга между onDidChange’сами
    // --------------------------------------------------------
    #debounceTimer: NodeJS.Timeout | null;
    #debounceDelay: number;
    // ------------------------------

    readonly #disposables: Disposable[];
    #disposed: boolean;

    readonly #asyncQueue: AsyncQueue;

    constructor(
        windowConfiguration: Safe<WindowConfiguration>,
        projectStateCoordinator: Safe<ResourceStateCoordinator>,
        // runtime: Safe<Runtime>,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {

        this.#disposed = false;

        this.#logOutputChannel = logOutputChannel;
        this.#stateCoordinator = projectStateCoordinator;
        this.#windowConfiguration = windowConfiguration;

        this.#debounceTimer = null;
        this.#debounceDelay = 15;


        // this.#runtime = runtime;

        this.#disposables = [

            this.#stateCoordinator.onDidChange(() => {
                if (this.#disposed) {
                    return;
                }
                this.#scheduleUpdate();
            }),

            this.#windowConfiguration.onDidChange((affectedKeys) => {
                if (this.#disposed) {
                    return;
                }
                if (affectedKeys.has('Filtering')) {
                    this.#scheduleUpdate();
                }
            })
        ];

        // this.#runtime.onDidChange((taskIdentifier) => {

        //     this.#globalTreeView.updateRunnable(taskIdentifier);
        //     this.#workspaceTreeView.updateRunnable(taskIdentifier);

        // });

        // @fixme dispose


        this.#globalTreeView = new TreeView(
            GLOBAL_TREE_VIEW_ID,
            this.#stateCoordinator,
            // this.#runtime.registry,
            this.#logOutputChannel
        );

        this.#workspaceTreeView = new TreeView(
            WORKSPACE_TREE_VIEW_ID,
            this.#stateCoordinator,
            // this.#runtime.registry,
            this.#logOutputChannel
        );


        this.#asyncQueue = AsyncQueue.create();

        this.#updateFromProjectState();

        void this.#setActivateContext(true);

    }


    public dispose() {

        if (this.#disposed) {
            return;
        }

        this.#disposed = true;

        this.#disposables.forEach(function (d) {
            d.dispose();
        });

        void this.#setActivateContext(false);

        this.#logOutputChannel?.trace(`${this.constructor.name}: disposed`);
        this.#logOutputChannel = null;
    }


    public expandAllInView(viewId: TreeViewId) {
        if (viewId === GLOBAL_TREE_VIEW_ID) {
            this.#globalTreeView.expandAll();
        }
        else if (viewId === WORKSPACE_TREE_VIEW_ID) {
            this.#workspaceTreeView.expandAll();
        }
    }


    #scheduleUpdate(): void {

        if (this.#disposed) {
            return;
        }

        // Перезапускаем таймер
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }

        this.#debounceTimer = setTimeout(() => {

            if (this.#disposed) {
                return;
            }

            this.#updateFromProjectState();

        }, this.#debounceDelay);
    }

    #updateFromProjectState() {

        if (this.#disposed) {
            return;
        }

        if (this.#stateCoordinator.disposed || this.#windowConfiguration.disposed) {
            return;
        }

        const scopeLayout = this.#stateCoordinator.getScopeLayout();

        // про no-null assertion: строится на основе "свежего" состояния полученного
        // от StateCoordinator, в пределах одного синхронного
        // блока — состояние **обязано** быть согласовано, иначе StateCoordinator сломан.
        // **`StateCoordinator#get*` не даёт частичных состояний**

        this.#globalTreeView.fullUpdate([buildScopesData(
            ScopeKey.GLOBAL_KEY,
            scopeLayout[ScopeKey.GLOBAL_KEY],
            [...this.#stateCoordinator.getTaskDefinitions(ScopeKey.GLOBAL_KEY)!.entries()],
            this.#stateCoordinator.getResourceConfig(ScopeKey.GLOBAL_KEY)!.Hierarchy,
        )]);

        const workspaceScopes: Immutable<{ key: ScopeKey; scope: Scope.WorkspaceScope | Scope.FolderScope; }>[] = [];

        // @todo isMultiroot+excluded выглядит коряво
        const isMultiroot = scopeLayout[ScopeKey.WORKSPACE_KEY] != null;

        // игнорируется для single-folder проекта
        const excluded = isMultiroot
            ? this.#windowConfiguration.getConfig('Filtering').excludeFolders
            : null;

        let excludedScopesCount = 0;

        if (isMultiroot) {
            if (excluded!.has(scopeLayout[ScopeKey.WORKSPACE_KEY]!.name)) {
                ++excludedScopesCount;
            }
            else {
                workspaceScopes.push({ key: ScopeKey.WORKSPACE_KEY, scope: scopeLayout[ScopeKey.WORKSPACE_KEY]! });
            }
        }

        if (scopeLayout.folders) {
            for (const [key, folderScope] of Object.entries(scopeLayout.folders)) {
                if (excluded?.has(folderScope.name)) {
                    ++excludedScopesCount;
                }
                else {
                    workspaceScopes.push({ key: key as ScopeKey.FolderKey, scope: folderScope });
                }
            }
        }

        this.#workspaceTreeView.fullUpdate(
            workspaceScopes.map(({ key: scopeKey, scope }) => {
                return buildScopesData(
                    scopeKey,
                    scope,
                    [...this.#stateCoordinator.getTaskDefinitions(scopeKey)!.entries()],
                    this.#stateCoordinator.getResourceConfig(scopeKey)!.Hierarchy,
                );
            }),
            excludedScopesCount
        );
    }


    // #region set**Context

    async #setActivateContext(isActivate: boolean) {
        // @todo isBusy
        return this.#asyncQueue.enqueue(() => commands.executeCommand<void>('setContext', `${VIEW_CONTAINER_ID}.isActivate`, isActivate));
    }

    // #endregion
}


function buildScopesData(
    scopeKey: ScopeKey,
    scope: Immutable<Scope.Scope>,
    taskDefinitions: ReadonlyArray<[taskName: TaskName, definition: Immutable<TaskDefinition>]>,
    hierarchyConfig: Immutable<Config['Hierarchy']>
): Immutable<ScopeData> {

    const { segmentSeparator, useGroupKind, showHidden } = hierarchyConfig;

    const splitter = Splitter.create(segmentSeparator);

    let total = 0;
    let hiddenCount = 0;

    const hierarchy = HierarchyModel.buildHierarchy({
        branchKey: scopeKey,
        specs:
            taskDefinitions.reduce((acc, [taskName, definition]) => {

                ++total;

                if (!showHidden && definition.hidden) {
                    ++hiddenCount;
                    return acc;
                }

                const groupKind = useGroupKind
                    ? definition.group?.kind
                    : undefined;

                const segments =
                    groupKind
                        ? [groupKind, ...splitter.split(taskName)]
                        : splitter.split(taskName);

                acc.push({ segments, data: { taskName } });

                return acc;

            }, [] as HierarchyModel.Spec<{ taskName: TaskName; }>[])
    }, 'off');

    return {
        scopeKey: scopeKey,
        displayName: scope.name,
        taskSource: scope.taskSource?.uri ?? null,
        detail: { total, hiddenCount },
        hierarchy
    };

}


export default Panel;
