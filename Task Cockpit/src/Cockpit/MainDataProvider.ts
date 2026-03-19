/** @file Cockpit/MainDataProvider.ts */
/** @module MainDataProvider */


import * as vscode from 'vscode';
import type * as TC from '../types';
import helpers from '../helpers';
import Tree from './Tree';
import Renderer from './Renderers';
// import Resolver from './Resolvers';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { assert, log } = Logger.get(module.filename);
// #endregion DEBUG


/** Поставщик данных основного дерева панели Task Cockpit.
 *
 * Реализует {@linkcode vscode.TreeDataProvider} для отображения иерархии задач и {@linkcode vscode.Disposable}
 * для освобождения ресурсов при деактивации расширения.
 *
 * Управляет двумя структурами данных:
 * - `roots` — корневые узлы дерева, задаются извне через `rebuild()`;
 * - `runnablesMap` — карта `TaskID → Runnable`, перестраивается при каждом
 *   новом обходе дерева (сейчас просто - при каждом обходе) и используется для
 *   точечного обновления узлов через {@linkcode refreshRunnableNode}. */
export default class MainDataProvider implements vscode.TreeDataProvider<Readonly<Tree.Node.NodeType>>, vscode.Disposable {


    private onDidChangeEmitter: vscode.EventEmitter<Readonly<Tree.Node.NodeType> | undefined | void> =
        new vscode.EventEmitter<Readonly<Tree.Node.NodeType> | undefined | void>();


    public readonly onDidChangeTreeData: vscode.Event<Readonly<Tree.Node.NodeType> | undefined | void> = this.onDidChangeEmitter.event;


    /** Корневые узлы дерева. */
    private roots?: Array<Tree.RootNode>;

    // private WorkspaceDetail?: TC.WorkspaceDetail;


    /** Карта TaskID → Runnable.
     *
     * Заполняется в {@linkcode getTreeItem} по мере обхода дерева.
     * Сбрасывается и пересоздаётся при каждом вызове `getChildren(undefined)`. */
    private runnablesMap: Map<Readonly<TC.TaskID>, Readonly<Tree.Node.Runnable>> | undefined;


    /** @param deps Зависимости, предоставляемые владельцем провайдера. */
    constructor(
        private readonly deps: {
            /** Текущее состояние процессов задачи. */
            readonly getRuntime_cb: (taskId: TC.TaskID) => Readonly<TC.RuntimeState> | undefined,
            /** Конфигурация отображения узлов для заданного файла задач. */
            readonly getNodeConfig_cb: (taskFile: TC.File) => Readonly<TC.NodeConfig>,
        }
    ) { }


    dispose() {

        this.onDidChangeEmitter.dispose();
        this.runnablesMap?.clear();
        this.runnablesMap = undefined;

        // #region DEBUG
        log(LogLevel.Debug, 'disposed');
        // #endregion DEBUG
    }


    // #region Public


    /** Полностью перестроить дерево.
     *
     * Сохраняет новый набор корневых узлов и сигнализирует VS Code о необходимости полностью обновить дерево.
     *
     * @param roots Новые корневые узлы. `undefined` очищает дерево.
     *
     * @fire `onDidChangeTreeData` */
    public rebuild(roots: ReadonlyArray<Readonly<Tree.RootNode>>): TC.WorkspaceDetail {
        // #region DEBUG
        log(LogLevel.Debug,
            'Rebuilding entire tree view ...');
        // #endregion DEBUG

        // Отфильтровать *корни*, помеченные как скрытые. (не задачи)
        this.roots = roots.filter((r) => !r.hide);

        this.onDidChangeEmitter.fire();

        return { total: roots.length, displayed: this.roots.length };
    }


    /** Обновить узел-задачу.
     *
     * Если задача с указанным ID зарегистрирована в {@linkcode runnablesMap},
     * инициирует обновление её узла.
     * Если узел не найден (например, дерево ещё не было отрисовано), вызов игнорируется.
     *
     * @fire `onDidChangeTreeData` */
    public refreshRunnableNode(id: TC.TaskID) {
        const node = this.runnablesMap?.get(id);
        if (node) {
            // #region DEBUG
            log(LogLevel.Debug,
                'Refreshing runnable node ...', helpers.printTaskId(id));
            // #endregion DEBUG
            this.onDidChangeEmitter.fire(node);
        }
        // #region DEBUG
        else {
            log(LogLevel.Debug,
                'Refreshing skipped: not in runnables map', helpers.printTaskId(id));
        }
        // #endregion DEBUG
    }


    /** Возвращает дочерние узлы для заданного узла дерева.
     *
     * При вызове без аргумента (корневой запрос) сбрасывает и пересоздаёт
     * {@linkcode runnablesMap} — это точка синхронизации, после которой VS Code
     * начинает работать с новым деревом.
     *
     * @throws Если вызван для узла типа `Marker` — это нарушение инварианта. */
    public getChildren(node?: Tree.Node.NodeType): Array<Tree.Node.NodeType> | undefined {

        // Если нода не передана — вернуть корни
        if (!node) {
            // Сброс карты зарегистрированных узлов-задач.
            // Нужно делать тут, а не в `rebuild()`, поскольку до
            // до того как VS Code дойдёт до `getChildren(undefined)` она показывает и
            // работает со "старым деревом", а значит - должна корректно работать с
            // "просроченными" узлами.
            this.runnablesMap = new Map();

            // Каст: WorkspaceRoot/FolderRoot структурно являются NodeType,
            // а гарантию что Builder.Node с данными действительно содержат
            // data обеспечивает Roots.ts — это инвариант построителя, не
            // выражаемый в системе типов без усложнения Builder.Node до дискриминированного union.
            // Tree.Node.NodeType сужается до Runnable с data: T — инвариант гарантирован логикой
            // построителя, но не типами.
            return this.roots;
        }

        // Для маркеров вообще не должно запрашиваться
        if (Tree.Node.isMarker(node)) {
            throw new Error('Internal error: "getChildren()" should never be called on "Marker" nodes');
        }

        if (Tree.Node.isRoot(node)) {
            return node.children;
        }

        return node.children;
    }


    /** Строит `TreeItem` для заданного узла дерева.
     *
     * Для `Runnable`-узлов попутно регистрирует их в {@linkcode runnablesMap},
     * обеспечивая возможность последующего точечного обновления. */
    public getTreeItem(node: Tree.Node.NodeType): vscode.TreeItem {

        if (Tree.Node.isConfigurable(node)) {

            const taskFile = Tree.Node.resolveScope(node);

            if (Tree.Node.isRunnable(node)) {

                const taskId = node.id;
                this.runnablesMap!.set(taskId, node); // @todo: не set если уже есть и === node

                return Renderer.runnable(node, this.deps.getNodeConfig_cb(taskFile), this.deps.getRuntime_cb(taskId));
            }

            return Renderer.intermediate(node, this.deps.getNodeConfig_cb(taskFile));
        }

        if (Tree.Node.isRoot(node)) {
            if (Tree.Node.isWorkspaceRootNode(node)) {
                return Renderer.workspace(node);
            }
            return Renderer.folder(node);
        }

        return Renderer.marker(node);
    }

    // @todo
    // /** Дополняет `TreeItem` данными, вычисляемыми лениво (например, tooltip).
    //  *
    //  * Вызывается VS Code при раскрытии или наведении на узел. */
    // public resolveTreeItem(item: vscode.TreeItem, node: Tree.Node.NodeType, token: vscode.CancellationToken): vscode.TreeItem {

    //     if (Tree.Node.isRoot(node)) {

    //         const taskFile = Tree.Node.resolveScope(node);

    //         if (Tree.Node.isWorkspaceRootNode(node)) {

    //             return Resolver.workspace(
    //                 item, node,
    //                 this.deps.getWorkspaceDetail_cb()!,
    //                 this.deps.getScopedDetail_cb(taskFile),
    //                 token
    //             );
    //         }
    //         return Resolver.folder(item, node, this.deps.getScopedDetail_cb(taskFile), token);
    //     }

    //     if (Tree.Node.isRunnable(node)) {
    //         return Resolver.runnable(item, node, this.deps.getTask_cb(node.id)!, token);
    //     }

    //     return item;
    // }

    // #endregion Public

}
