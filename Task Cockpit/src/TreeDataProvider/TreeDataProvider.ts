import {
    EventEmitter,
    Event,
    type CancellationToken,
    type TreeDataProvider as VscTreeDataProvider,
    type TreeItem,
} from 'vscode';
import * as assert from 'node:assert/strict';
import ElementType from './ElementType';
import EmptyElement from './Node/EmptyElement';
import Hierarchy from '../HierarchyModel/Hierarchy';
import IntermediateElement from './Node/IntermediateElement';
import NodeId from './NodeId';
import PinsElement from './Section/PinsElement';
import RunnableElement from './Node/RunnableElement';
import ScopeElement from './Section/ScopeElement';
import type HierarchyElement from '../HierarchyModel/HierarchyElement';
import type ScopeKey from '../Scope/Key';
import type ScopeMap from '../ProjectSpace/ScopeMap';
import type TaskName from '../TaskName/TaskName';
import type EligibleMap from '../EligibleTask/EligibleMap';
import type RuntimeRegistry from '../Runtime/RuntimeRegistry';
import type Element from './Element';


export default class TreeDataProvider implements VscTreeDataProvider<Readonly<Element>> {


    readonly #onDidChangeTreeData: EventEmitter<Readonly<Element> | void>;
    readonly onDidChangeTreeData: Event<void | Readonly<Element>>;


    #runnableElementToTreeItem: Map<Readonly<RunnableElement>, TreeItem>;
    #runnableIdentifierToElements: Map<ScopeKey, Map<TaskName, Set<Readonly<RunnableElement>>>>;

    #roots: Array<Readonly<ScopeElement | PinsElement>> | null;

    #scopeMap: Readonly<ScopeMap>;
    #eligibleMap: EligibleMap | null;

    readonly #runtimeRegistry: RuntimeRegistry;


    public constructor(
        runtimeRegistry: RuntimeRegistry,
    ) {

        this.#roots = null;
        this.#scopeMap = new Map();
        this.#eligibleMap = null;

        this.#runnableElementToTreeItem = new Map();
        this.#runnableIdentifierToElements = new Map();

        this.#runtimeRegistry = runtimeRegistry;

        this.#onDidChangeTreeData = new EventEmitter<Readonly<Element> | void>();
        this.onDidChangeTreeData = this.#onDidChangeTreeData.event;
    }


    public dispose() {
        this.#onDidChangeTreeData.dispose();
    }


    public updateAll(
        scopeMap: Readonly<ScopeMap>,
        eligibleMap: EligibleMap
    ) {

        this.#runnableElementToTreeItem = new Map();
        this.#runnableIdentifierToElements = new Map();
        this.#roots = null;

        this.#scopeMap = scopeMap;
        this.#eligibleMap = eligibleMap;

        this.#onDidChangeTreeData.fire();
    }


    public updateRuntimeState(scopeKey: ScopeKey, taskName: TaskName) {

        const elements = this.#runnableIdentifierToElements.get(scopeKey)?.get(taskName);

        if (!elements || elements.size < 1) {
            return;
        }

        for (const element of elements) {
            this.#onDidChangeTreeData.fire(element);
        }

    }


    public getTreeItem(element: Readonly<Element>): TreeItem {

        switch (element.type) {

            case ElementType.PinsSection: {
                return PinsElement.createTreeItem(element);
            }

            case ElementType.ScopeSection: {
                return ScopeElement.createTreeItem(element);
            }

            case ElementType.EmptyNode: {
                return EmptyElement.createTreeItem(element);
            }

            case ElementType.IntermediateNode: {
                // intermediate node
                return IntermediateElement.createTreeItem(element, {
                    conf: this.#scopeMap.get(element.scopeKey)?.nodeConfig ?? null
                });
            }

            case ElementType.RunnableNode: {
                // runnable node

                const scopeKey = element.scopeKey;
                const taskName = element.taskName;

                { // -----
                    // регистрация элемента по идентификатору,
                    // если еще не зарегистрирован.
                    // @todo: возможно это нужно делать при создании runnable элемента?
                    let elementsByTask = this.#runnableIdentifierToElements.get(scopeKey);
                    if (!elementsByTask) {
                        elementsByTask = new Map();
                        this.#runnableIdentifierToElements.set(scopeKey, elementsByTask);
                    }

                    let elementSet = elementsByTask.get(taskName);
                    if (!elementSet) {
                        elementSet = new Set();
                        elementsByTask.set(taskName, elementSet);
                    }

                    elementSet.add(element);

                } // -----

                let registeredTreeItem = this.#runnableElementToTreeItem.get(element);

                if (!registeredTreeItem) {
                    // Не зарегистрированный TreeItem — первый вызов getTreeItem()
                    // для этого element.

                    assert.ok(this.#scopeMap.has(scopeKey), `getTreeItem called for stale element: ${scopeKey}`);

                    // scopeData может быть falsy для staled pins? -- нет:
                    // Пины вне валидных scopes не должны попадать в дерево.
                    const scopeData = this.#scopeMap.get(scopeKey);

                    registeredTreeItem = RunnableElement.createTreeItem(element, {
                        conf: scopeData!.nodeConfig,
                        taskDefinition: scopeData!.definitions.get(taskName) ?? null,
                        hasEligibleTask: this.#eligibleMap?.get(scopeKey)?.has(taskName) ?? false,
                    });

                    this.#runnableElementToTreeItem.set(element, registeredTreeItem);
                }

                // Обновить TreeItem на основе runtime stats
                RunnableElement.applyRuntimeState(registeredTreeItem, this.#runtimeRegistry.getStats(scopeKey, taskName) ?? null);

                return registeredTreeItem;
            }

            default: {
                const _: never = element;
                assert.fail('never give you up...');
            }
        }
    }


    getChildren(element?: Readonly<Element>): Array<Readonly<Element>> | null {

        if (!element) { // сначала дерево заполняется "секциями"

            if (this.#roots) {
                return this.#roots;
            }

            if (this.#scopeMap.size < 1) {
                return null;
            }

            const scopeSections: Array<Readonly<ScopeElement>> = [];
            // for pins
            const pinSubSections: Array<[ScopeKey, ReadonlyArray<Readonly<HierarchyElement>>]> = [];

            for (const [scopeKey, scopeData] of this.#scopeMap) {

                if (scopeData.pinHierarchy) {
                    pinSubSections.push([scopeKey, scopeData.pinHierarchy]);
                }

                if (scopeData.scopeHierarchy) {
                    scopeSections.push(ScopeElement.create(
                        scopeKey,
                        scopeData.label,
                        scopeData.sourceUri,
                        scopeData.scopeHierarchy,
                        scopeData.detail
                    ));
                }
            }

            const roots: Array<Readonly<ScopeElement | PinsElement>> = [];

            if (pinSubSections.length > 0) {
                roots.push(
                    PinsElement.create(new Map(pinSubSections))
                );
            }

            roots.push(...scopeSections);
            this.#roots = roots;
            return roots;
        }

        switch (element.type) {

            case ElementType.PinsSection: {

                const subsections = element.children;

                assert.ok(subsections.size > 0);

                if (subsections.size > 1) {

                    const pinsChildren: Array<Readonly<IntermediateElement>> = [];
                    for (const [scopeKey, hierarchyChild] of subsections) {
                        assert.ok(this.#scopeMap.has(scopeKey));
                        const label = this.#scopeMap.get(scopeKey)!.label;
                        pinsChildren.push(
                            IntermediateElement.create(
                                NodeId.buildNodeId(element.id, label),
                                scopeKey,
                                label,
                                hierarchyChild
                            )
                        );
                    }
                    return pinsChildren;
                }

                const [scopeKey, hierarchy] = subsections.entries().next().value!;

                return createElementChildren(
                    element.id,
                    scopeKey,
                    hierarchy
                );
            }

            case ElementType.ScopeSection: {
                // ScopeSection — секция "источник-задач".
                // Презентует workspace, директорию или глобальное пространство.
                // Отображается всегда, даже если пуста.

                const sectionChildren: Array<Readonly<IntermediateElement | RunnableElement | EmptyElement>>
                    = createElementChildren(
                        element.id,
                        element.scopeKey,
                        element.children
                    );

                if (sectionChildren.length < 1) {
                    // иерархия пуста, нет задач в области — Вставляем заглушку
                    const scopeKey = element.scopeKey;
                    const emptyElement = EmptyElement.create(
                        NodeId.buildNodeId(element.id, '_empty_node'), // безопасно поскольку всегда единственный в секции
                        scopeKey,
                        this.#scopeMap.get(scopeKey)?.detail
                    );

                    sectionChildren.push(emptyElement);
                }

                return sectionChildren;
            }

            case ElementType.RunnableNode:
            case ElementType.IntermediateNode: {
                const hierarchies = element.children;
                if (!hierarchies) {
                    return null;
                }
                const elementChildren = createElementChildren(
                    element.id,
                    element.scopeKey,
                    hierarchies
                );
                return elementChildren;
            }

            case ElementType.EmptyNode: {
                return null;
            }

            default: {
                const _: never = element;
                assert.fail('never give you up...');
            }

        }

    }


    public resolveTreeItem(item: TreeItem, element: Readonly<Element>, token: CancellationToken): TreeItem {

        switch (element.type) {

            case ElementType.PinsSection: {
                return PinsElement.resolveTreeItem(item, element, token);
            }

            case ElementType.ScopeSection: {
                return ScopeElement.resolveTreeItem(item, element, token);
            }

            case ElementType.EmptyNode: {
                return EmptyElement.resolveTreeItem(item, element, token);
            }

            case ElementType.RunnableNode: {
                return RunnableElement.resolveTreeItem(item, element, {
                    hasDefinition: this.#scopeMap.get(element.scopeKey)?.definitions.has(element.taskName) ?? false,
                    eligibleTask: this.#eligibleMap?.get(element.scopeKey)?.get(element.taskName) ?? null
                }, token);
            }

            case ElementType.IntermediateNode: {
                return IntermediateElement.resolveTreeItem(item, element, token);
            }


            default: {
                const _: never = element;
                assert.fail('never give you up...');
            }
        }
    }


    public getParent = undefined;

    // ---------------------------------------------------------------------------


}


function createElementChildren(
    parentId: NodeId,
    parentScopeKey: ScopeKey,
    hierarchies: ReadonlyArray<Readonly<HierarchyElement>>
): Array<Readonly<IntermediateElement | RunnableElement>> {

    const elementChildren: Array<Readonly<RunnableElement | IntermediateElement>> = [];
    for (const hierarchy of hierarchies) {
        const childElement = createChildElement(parentId, parentScopeKey, hierarchy);
        elementChildren.push(childElement);
    }

    return elementChildren;
}

function createChildElement(
    parentId: NodeId,
    parentScopeKey: ScopeKey,
    hierarchy: HierarchyElement
): Readonly<IntermediateElement | RunnableElement> {

    // Сегмент → label — всегда уникальный среди детей
    const label = Hierarchy.Node.getSegment(hierarchy);

    const taskName: TaskName | null =
        (Hierarchy.Node.isData(hierarchy))
            ? hierarchy.taskName
            : null;

    const subHierarchy: ReadonlyArray<Readonly<HierarchyElement>> | null =
        (Hierarchy.Node.isBranch(hierarchy))
            ? Hierarchy.Node.getBranchChildren(hierarchy)
            : null;

    if (taskName != null) {
        const runnableElement = RunnableElement.create(
            NodeId.buildNodeId(parentId, label),
            parentScopeKey,
            label,
            subHierarchy,
            taskName
        );
        return runnableElement;
    }

    assert.ok(subHierarchy, `Node "${label}" is neither data nor branch — malformed hierarchy`);

    const intermediateElement = IntermediateElement.create(
        NodeId.buildNodeId(parentId, label),
        parentScopeKey,
        label,
        subHierarchy
    );

    return intermediateElement;
}
