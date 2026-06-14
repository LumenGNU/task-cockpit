import {
    EventEmitter,
    type CancellationToken,
    type ProviderResult,
    type TreeDataProvider as VscTreeDataProvider,
    type TreeItem,
} from 'vscode';
import * as assert from 'node:assert/strict';
import EmptyNode from './Node/EmptyNode';
import IntermediateNode from './Node/IntermediateNode';
import NodeType from './NodeType';
import RunnableNode from './Node/RunnableNode';
import type Runtime from '../Runtime/Runtime';
import type ScopeKey from '../Scope/Key';
import ScopeSection from './Section/ScopeSection';
import type ProjectMap from '../ProjectSpace/ProjectMap';
import type TaskName from '../type.d/TaskName';
import type EligibleMap from '../EligibleTask/EligibleMap';
import createContentNode from './createContentNode';
import createEmptyNode from './createEmptyNode';
import createSectionNode from './createSectionNode';
import type PinMap from '../UserState/PinMap';


type Sections =
    // | PinsSection
    | ScopeSection
    ;

type Child =
    | EmptyNode
    // | SubSection
    | RunnableNode
    | IntermediateNode
    ;

type Nodes =
    | Sections
    | Child
    ;

// @todo parents через weakMap
export default class TreeDataProvider implements VscTreeDataProvider<Readonly<Nodes>> {


    readonly #onDidChangeTreeData = new EventEmitter<Nodes | void>();
    readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;


    #workspaceSnapshot: ProjectMap;

    #eligibleMap: EligibleMap; // @fixme кеш!


    #runnableNodes: Map<ScopeKey, Map<TaskName, WeakRef<Readonly<RunnableNode>>>>;

    #parentsMap: WeakMap<Readonly<Nodes>, Readonly<Nodes> | null>;

    #runtime: Runtime['registry'];


    constructor(
        props: {
            runtime: Runtime['registry'],
            workspaceSnapshot: ProjectMap,
            eligibleMap: EligibleMap;
            pins: PinMap;
        }
    ) {

        this.#runnableNodes = new Map();

        this.#parentsMap = new WeakMap();

        this.#runtime = props.runtime;

        this.#workspaceSnapshot = props.workspaceSnapshot;
        this.#eligibleMap = props.eligibleMap;
    }


    dispose() {
        // @fixme
    }


    public getTreeItem(element: Readonly<Nodes>): TreeItem {

        switch (element.nodeType) {

            case NodeType.ScopeSection: {
                return ScopeSection.getTreeItem(element);
            }

            case NodeType.EmptyNode: {
                return EmptyNode.getTreeItem(element);
            }

            case NodeType.IntermediateNode: {
                // intermediate node
                const scopeKey = element.viewData.scopeKey;
                const scopeInput = this.#workspaceSnapshot.get(scopeKey);
                return IntermediateNode.getTreeItem(element, {
                    conf: scopeInput?.config.nodeConf ?? null
                });
            }

            case NodeType.RunnableNode: {
                // runnable node
                const scopeKey = element.viewData.scopeKey;
                const scopeInput = this.#workspaceSnapshot.get(scopeKey);
                const taskName = element.viewData.taskName;

                // регистрация ноды по область + имя задачи
                let namesMap = this.#runnableNodes.get(scopeKey);
                if (!namesMap) {
                    namesMap = new Map();
                    this.#runnableNodes.set(scopeKey, namesMap);
                }
                namesMap.set(taskName, new WeakRef(element));

                return RunnableNode.getTreeItem(element, {
                    conf: scopeInput?.config.nodeConf ?? null,
                    definition: scopeInput?.definitions.get(taskName) ?? null,
                    eligibleTask: this.#eligibleMap.get(scopeKey)?.get(taskName) ?? null,
                    runtimeState: this.#runtime.Stats.get(scopeKey)?.get(taskName) ?? null
                });
            }

            default: {
                const _: never = element;
                assert.fail('never give you up...');
            }
        }

    }


    getChildren(element?: Readonly<Nodes>): Array<Readonly<Nodes>> | null {

        if (!element) { // сначала дерево заполняется "секциями"

            const sections: Array<Readonly<Sections>> = [];

            // // первой идет секция с закрепленными задачами
            // // если отображение разрешено и **не пуста**
            // if (this.#pinsSection) {
            //     sections.push(this.#pinsSection);
            // }

            // потом секции по scope
            // Note: "workspace первым" — структурный инвариант входных данных.
            for (const [scopeKey, scopeInput] of this.#workspaceSnapshot) {
                // @todo filter
                sections.push(createSectionNode(scopeKey, scopeInput));
            }

            return sections.length > 0
                ? sections
                // Если в итоге пусто, то ничего не показываем, все очищаем
                : null;
        }



        switch (element.nodeType) {

            // // PinsSection
            // case NodeKey.PinsSectionKey: {



            // }


            case NodeType.ScopeSection: {
                // ScopeSection — секция "источник-задач".
                // Презентует workspace, директорию или глобальное пространство.
                // Отображается всегда, даже если пуста.

                const children: Array<Readonly<RunnableNode | IntermediateNode | EmptyNode>> = [];
                // создаем Content-Node для каждого hierarchy-элемента
                for (const hierarchy of element.viewData.children) {
                    const contentNode = createContentNode(element, hierarchy);
                    this.#parentsMap.set(contentNode, element);
                    children.push(contentNode);
                }

                if (children.length < 1) {
                    // иерархия пуста, нет задач в области — Вставляем заглушку
                    const emptyNode = createEmptyNode(element);
                    this.#parentsMap.set(emptyNode, element);
                    children.push(emptyNode);
                }

                return children;
            }

            case NodeType.RunnableNode:
            case NodeType.IntermediateNode: {
                const hierarchies = element.viewData.children;
                if (!hierarchies) {
                    return null;
                }
                const children: Array<Readonly<RunnableNode | IntermediateNode>> = [];
                for (const hierarchy of hierarchies) {
                    const contentNode = createContentNode(element, hierarchy);
                    this.#parentsMap.set(contentNode, element);
                    children.push(contentNode);
                }

                return children;
            }

            case NodeType.EmptyNode: {
                return null;
            }

            default: {
                const _: never = element;
                assert.fail('never give you up...');
            }

        }

    }


    resolveTreeItem(item: TreeItem, element: Readonly<Nodes>, token: CancellationToken): ProviderResult<TreeItem> {

        switch (element.nodeType) {

            case NodeType.ScopeSection: {
                return ScopeSection.resolveTreeItem(item, element, token);
            }

            case NodeType.EmptyNode: {
                return EmptyNode.resolveTreeItem(item, element, token);
            }

            case NodeType.RunnableNode: {
                return RunnableNode.resolveTreeItem(item, element, {
                    definition: this.#workspaceSnapshot.get(element.viewData.scopeKey)?.definitions.get(element.viewData.taskName) ?? null,
                    eligibleTask: this.#eligibleMap.get(element.viewData.scopeKey)?.get(element.viewData.taskName) ?? null
                }, token);
            }

            case NodeType.IntermediateNode: {
                return IntermediateNode.resolveTreeItem(item, element, token);
            }


            default: {
                const _: never = element;
                assert.fail('never give you up...');
            }
        }
    }


    getParent(element: Readonly<Nodes>): Readonly<Nodes> | null {
        return this.#parentsMap.get(element) ?? null;
    }

    // ---------------------------------------------------------------------------

}
