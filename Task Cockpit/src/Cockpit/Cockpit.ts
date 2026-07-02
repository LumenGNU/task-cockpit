import {
    window,
    TreeView as VscTreeView,
    Disposable,
    workspace
} from 'vscode';
import TreeDataProvider from '../TreeDataProvider/TreeDataProvider';
import RuntimeRegistry from '../Runtime/RuntimeRegistry';
import Runtime from '../Runtime/Runtime';

import {
    CONFIG_BASE_SECTION
} from '../constants';
import Element from '../TreeDataProvider/Element';
import FileDecorationProvider from '../DecorationProvider/FileDecorationProvider';
import ConfigurationProvider from '../Configuration/ConfigurationProvider';
import {
    CancellationError,
    TaskScope,
    type CancellationToken,
    CancellationTokenSource,
    LogOutputChannel
} from 'vscode';
import buildHierarchy from '../HierarchyModel/buildHierarchy';

import getDisplayName from '../Scope/getDisplayName';
import getScopeKey from '../Scope/getKey';
import getSourceUri from '../Scope/getSourceUri';
import getType from '../Scope/getType';
import type DefinitionId from '../EligibleTask/DefinitionId';
import type Folder from '../Scope/Folder/Folder';
import Scope from '../Scope/Scope';
import TaskName from '../TaskName/TaskName';
import * as assert from 'node:assert/strict';
import TaskGroup from '../Configuration/TaskGroup';
import CompressionBehavior from '../HierarchyModel/CompressionBehavior';
import ScopeData from '../ProjectSpace/ScopeData';
import TaskDefinition from '../Configuration/TaskDefinition';
import ResourceConfig from '../Configuration/Resource/Config';
import ScopeType from '../Scope/Type';
import fetchEligibleTasks from '../EligibleTask/fetchEligibleTasks';




class Cockpit {

    readonly #runtime: Runtime;
    readonly #configurationProvider: ConfigurationProvider;

    readonly #treeView: VscTreeView<Readonly<Element>>;

    readonly #fileDecorationProvider: FileDecorationProvider;

    readonly #disposable: Array<Disposable>;

    readonly #treeDataProvider: TreeDataProvider;

    constructor() {

        this.#disposable = [];

        this.#configurationProvider = new ConfigurationProvider(CONFIG_BASE_SECTION);

        this.#fileDecorationProvider = new FileDecorationProvider(this.#configurationProvider);

        this.#disposable.push(
            window.registerFileDecorationProvider(this.#fileDecorationProvider)
        );

        this.#runtime = new Runtime(this.#configurationProvider);

        this.#treeDataProvider = new TreeDataProvider(this.#runtime.registry),

            this.#disposable.push(
                this.#treeView = window.createTreeView('task-cockpit-view', {
                    treeDataProvider: this.#treeDataProvider,
                    canSelectMany: false,
                    dragAndDropController: undefined,
                    manageCheckboxStateManually: undefined,
                    showCollapseAll: true // @todo
                })
            );


        this.#disposable.push(
            this.#configurationProvider.onDidChange(() => {

                // @todo
                void this.#rebuildTaskTree();
            })
        );


    }

    dispose() {
        this.#rebuildCts?.cancel();
        this.#rebuildCts?.dispose();
    }


    collapseAll() { }

    expandAll() { }


    pin() { }

    unpin() { }


    forceUpdate() {
        void this.#rebuildTaskTree();
    }

    // ------------------------------------------------------------------------------


    #rebuildCts: CancellationTokenSource | undefined;

    async #rebuildTaskTree() {

        // Отменяем предыдущий запуск, если он ещё жив
        this.#rebuildCts?.cancel();
        this.#rebuildCts?.dispose();

        const cts = new CancellationTokenSource();
        this.#rebuildCts = cts;

        try {


            const { filtering, pins } = this.#configurationProvider.readWindowConfig('ProjectSpaceConf');

            const scopeMap = new Map(scopes.map(function (this: Cockpit, scope) {
                const label = getDisplayName(scope);
                return [getScopeKey(scope), buildScopeData(
                    scope,
                    getType(scope),
                    label,
                    filtering.excludeFolders.has(label),
                    this.#configurationProvider.readTaskDefinitions(scope),
                    this.#configurationProvider.readResourceConfig(scope),
                    null // @todo
                )] as const;
            }, this));

            const eligibleMap = await fetchEligibleTasks(cts.token);

            if (cts.token.isCancellationRequested) {
                return;
            }

            this.#treeDataProvider.updateAll(scopeMap, eligibleMap);

        } finally {
            if (this.#rebuildCts === cts) {
                this.#rebuildCts = undefined;
                cts.dispose();
            }
        }
    }
}


/** Строит снимок состояния области рабочего пространства: загружает определения задач,
 * ???применяет фильтрацию по настройкам области и глобальным исключениям???,
 * вычисляет иерархии задач и закреплённых элементов.
 *
 * Поведение при фильтрации задач:
 * - если `label` области входит в `globalConf.filtering.excludeFolders` —
 *   список отфильтрованных задач равен `null`, иерархия задач не строится — `scopeHierarchy = null`,
 *   все задачи области считаются скрытыми;
 * - если `scopedConf.Filtering.showHidden` равен `false` — из списка исключаются задачи
 *   с флагом `definition.hidden === true`;
 * - если `scopedConf.Filtering.showHidden` равен `true` — список содержит все задачи.
 *
 * Поведение при построении иерархии задач: ???
 *
 * Поведение при построении иерархии закреплённых:
 * - если `globalConf.pins.visibility` равен `false` или `userProps.pins` равен `null` —
 *   иерархия пинов не строится — `pinHierarchy = null`.
 * */
function buildScopeData(
    scope: Scope,
    type: ScopeType,
    label: string,
    excluded: boolean,
    definitions: ReadonlyMap<TaskName, TaskDefinition>,
    resourceConfig: Readonly<ResourceConfig>,
    pins: Readonly<{
        pathCompression: CompressionBehavior,
        refs: ReadonlyMap<TaskName, DefinitionId | null> | null;
    }> | null,
): Readonly<ScopeData> {

    //assert(excluded) @fixme excluded=true и !pins или pins.refs.size == 0 -- не должно происходить



    // фильтрация hidden=true, если нужно.
    // Для построения иерархии.
    // Когда строить иерархию:
    // - excluded = false
    // В остальных случаях scopeHierarchy=null
    // Когда фильтровать иерархию:
    // - resourceConfig.Filtering.showHidden = false

    const filteredSpecs =
        excluded
            ? null
            : [...definitions.entries()].reduce(
                function (acc, [taskName, definition]) {
                    if (!resourceConfig.Filtering.showHidden && definition.hidden) {
                        return acc;
                    }
                    acc.push({ name: taskName, groupKind: definition.group, data: { taskName } });
                    return acc;
                }, [] as Readonly<{
                    name: string;
                    groupKind: TaskGroup | null;
                    data: { readonly taskName: TaskName; };
                }>[]);

    // Пины не фильтруются по hidden=true.
    const pinnedSpecs =
        !(pins?.refs && pins.refs.size > 0)
            ? null
            : [...pins.refs.keys()].map(function (taskName) {
                return {
                    name: taskName,
                    groupKind: definitions.get(taskName)?.group ?? null,
                    data: { taskName }
                } satisfies {
                    name: string;
                    groupKind: TaskGroup | null;
                    data: { readonly taskName: TaskName; };
                };
            });


    return {
        type,
        label,
        sourceUri: getSourceUri(scope),
        nodeConfig: resourceConfig.Node,
        definitions, // даже если excluded = true. нужна пинам
        scopeHierarchy: filteredSpecs ? buildHierarchy(filteredSpecs, resourceConfig.Hierarchy, 'off') : null,
        detail: { total: definitions.size, hiddenCount: definitions.size - (filteredSpecs?.length || 0) },
        pinHierarchy: pinnedSpecs && pinnedSpecs.length > 0 ? buildHierarchy(pinnedSpecs, resourceConfig.Hierarchy, pins!.pathCompression) : null,
        userProps: {
            pins: pins?.refs ?? null
        }
    };
}


export default Cockpit;
