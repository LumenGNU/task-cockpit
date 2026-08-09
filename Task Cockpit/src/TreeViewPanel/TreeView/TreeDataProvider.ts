import {
    EventEmitter,
    Event,
    type CancellationToken,
    type TreeDataProvider as VscTreeDataProvider,
    type TreeItem,
    type ProviderResult,
    LogOutputChannel
} from 'vscode';
import * as assert from 'node:assert/strict';
import ElementType from './ElementType';
import EmptyElement from './Element/EmptyElement';
import IntermediateElement from './Element/IntermediateElement';
import RunnableElement from './Element/RunnableElement';
import TopElement from './Element/TopElement';
import type TaskName from '../../TaskName';
// import type RuntimeRegistry from '../../Runtime/RuntimeRegistry';
import { ResourceStateCoordinator } from '../../ResourceState/ResourceStateCoordinator';
import type Safe from '../../utils/Safe';


import ScopeData from '../ScopeData';
import ScopeKey from '../../ScopeKey';
import type Immutable from '../../utils/Immutable';

type Element =
    | TopElement
    | EmptyElement
    | IntermediateElement
    | RunnableElement
    ;

type ReadonlyTreeDataProvider<T> =
    Omit<VscTreeDataProvider<T>, 'getChildren'> & {
        getChildren(element?: T): ProviderResult<ReadonlyArray<Readonly<T>>>;
    };

class TreeDataProvider implements ReadonlyTreeDataProvider<Immutable<Element>> {


    readonly #onDidChangeTreeData: EventEmitter<Immutable<Element> | void>;
    readonly onDidChangeTreeData: Event<Immutable<Element> | void>;

    readonly #onStartUpdate: EventEmitter<void>;
    readonly onStartUpdate: Event<void>;

    readonly #onBeenUpdated: EventEmitter<void>;
    readonly onBeenUpdated: Event<void>;


    #runnableElementToTreeItem: WeakMap<Immutable<RunnableElement>, TreeItem>;


    #identifierToRunnableElement: Map<ScopeKey, Map<TaskName, Immutable<RunnableElement>>>;

    // null - не строилось, требует обновления
    #topElements: Immutable<Array<TopElement>> | null;

    #scopesData: Immutable<Array<ScopeData>>;

    // readonly #runtimeRegistry: RuntimeRegistry;
    readonly #stateCoordinator: Safe<ResourceStateCoordinator>;



    public constructor(
        stateCoordinator: Safe<ResourceStateCoordinator>,
        // runtimeRegistry: RuntimeRegistry,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {

        // ------
        this.#runnableElementToTreeItem = new WeakMap();
        this.#identifierToRunnableElement = new Map();
        this.#topElements = null;

        // this.#runtimeRegistry = runtimeRegistry;
        this.#stateCoordinator = stateCoordinator;

        this.#onDidChangeTreeData = new EventEmitter();
        this.onDidChangeTreeData = this.#onDidChangeTreeData.event;

        this.#onStartUpdate = new EventEmitter();
        this.onStartUpdate = this.#onStartUpdate.event;

        this.#onBeenUpdated = new EventEmitter();
        this.onBeenUpdated = this.#onBeenUpdated.event;

        this.#scopesData = [];
    }


    public dispose() {
        this.#onDidChangeTreeData.dispose();
        this.#onBeenUpdated.dispose();
    }


    public fullUpdate(scopesData: Immutable<Array<ScopeData>>) {

        // ------ // @todo в отдельный метод?
        this.#runnableElementToTreeItem = new WeakMap();
        this.#identifierToRunnableElement = new Map();
        this.#scopesData = scopesData;
        this.#topElements = null;
        this.#onDidChangeTreeData.fire();
    }


    public updateRunnable({ scopeKey, taskName }: { scopeKey: ScopeKey, taskName: TaskName; }) {

        const runnableElement = this.#identifierToRunnableElement.get(scopeKey)?.get(taskName);
        if (!runnableElement) {
            return;
        }

        this.#onDidChangeTreeData.fire(runnableElement);
    }


    public getTreeItem(element: Element): TreeItem {

        if ('type' in element) {
            switch (element.type) {


                case ElementType.TopElement: {
                    return TopElement.createTreeItem(element);
                }

                case ElementType.EmptyNode: {
                    return EmptyElement.createTreeItem(element);
                }

                default: {
                    const _: never = element;
                    assert.fail('never give you up...');
                }

            }
        }

        if (element.data != null) {
            // runnable node

            const scopeKey = element.branchKey;
            const taskName = element.data.taskName;

            { // -----
                // регистрация runnable-элемента по идентификатору,
                // если еще не зарегистрирован.
                let elementsByTask = this.#identifierToRunnableElement.get(scopeKey);
                if (!elementsByTask) {
                    elementsByTask = new Map();
                    this.#identifierToRunnableElement.set(scopeKey, elementsByTask);
                }

                if (!elementsByTask.has(taskName)) {
                    elementsByTask.set(taskName, element);
                }
            } // -----

            // Для оптимизации при частом обновлении runtime-состояния
            let registeredTreeItem = this.#runnableElementToTreeItem.get(element);
            if (!registeredTreeItem) {
                // Не зарегистрированный TreeItem — первый вызов getTreeItem()
                // для этого element.

                // может быть falsy для X? -- нет:
                // Х вне валидных scopes не должны попадать в дерево.

                registeredTreeItem = RunnableElement.createTreeItem(element, {
                    conf: this.#stateCoordinator.getResourceConfig(scopeKey)?.Node ?? null,
                    taskDefinition: this.#stateCoordinator.getTaskDefinitions(scopeKey)?.get(taskName) ?? null,
                    hasEligibleTask: this.#stateCoordinator.getEligibleTasks(scopeKey)?.has(taskName) ?? false,
                });

                this.#runnableElementToTreeItem.set(element, registeredTreeItem);
            }

            // Обновить зарегистрированный TreeItem на основе runtime stats
            // RunnableElement.applyRuntimeState(registeredTreeItem, this.#runtimeRegistry.getStats(scopeKey, taskName) ?? null);

            return registeredTreeItem;

        }

        // Чистый промежуточный элемент
        return IntermediateElement.createTreeItem(element, {
            conf: this.#stateCoordinator.getResourceConfig(element.branchKey)?.Node ?? null
        });

    }


    getChildren(element?: Immutable<Element>): Immutable<Array<Element>> | null {

        if (this.#stateCoordinator.disposed) {
            return null;
        }

        if (!element) { // сначала дерево заполняется "top-узлами"

            if (this.#topElements) {
                // "это" дерево уже строилось
                return this.#topElements;
            }

            this.#onStartUpdate.fire();
            const topElements: Array<Immutable<TopElement>> = [];

            if (this.#scopesData.length > 0) {
                // если есть что строить

                for (const scopeData of this.#scopesData) {

                    topElements.push(TopElement.create(
                        scopeData.displayName,
                        scopeData.scopeKey,
                        scopeData.taskSource,
                        scopeData.hierarchy.children,
                        scopeData.detail,
                    ));
                }
            }

            this.#topElements = topElements;
            this.#onBeenUpdated.fire();
            return this.topElements;
        }

        if ('type' in element) {

            switch (element.type) {

                case ElementType.TopElement: {
                    if (element.children.length > 0) {
                        return element.children;
                    }
                    return [
                        EmptyElement.create(
                            /*id*/ element.branchKey + '_empty_node', // безопасно поскольку всегда единственный в секции
                            element.detail
                        )
                    ];
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

        return element.children;

    }


    public resolveTreeItem(item: TreeItem, element: Immutable<Element>, token: CancellationToken): TreeItem {

        if ('type' in element) {

            switch (element.type) {

                case ElementType.TopElement: {
                    return TopElement.resolveTreeItem(item, element, token);
                }

                case ElementType.EmptyNode: {
                    return EmptyElement.resolveTreeItem(item, element, token);
                }

                default: {
                    const _: never = element;
                    assert.fail('never give you up...');
                }
            }
        }

        if (element.data != null) {
            return RunnableElement.resolveTreeItem(item, element, {
                hasDefinition: this.#stateCoordinator.getTaskDefinitions(element.branchKey)?.has(element.data.taskName) ?? false,
                eligibleTask: this.#stateCoordinator.getEligibleTasks(element.branchKey)?.get(element.data.taskName) ?? null
            }, token);
        }

        return IntermediateElement.resolveTreeItem(item, element, token);

    }


    public getParent(element: Immutable<Element>) {
        return null;
    };

    // ---------------------------------------------------------------------------

    public get topElements(): Immutable<Array<TopElement>> | null {
        return this.#topElements;
    }



}

export default TreeDataProvider;
