/** @file Cockpit/MainDataProvider.ts */
/** @module MainDataProvider */


import * as vscode from 'vscode';
import type * as TC from '../types';
import helpers from '../helpers';
import Tree from './Tree';
import Renderer from './Renderers';
import Resolver from './Resolvers';


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
    private roots?: Array<Tree.Node.RootNode>;

    // private WorkspaceDetail?: TC.WorkspaceDetail;


    /** Карта TaskID → Runnable.
     *
     * Заполняется в {@linkcode getTreeItem} по мере обхода дерева.
     * Сбрасывается и пересоздаётся при каждом вызове `getChildren(undefined)`. */
    private runnablesMap?: Map<Readonly<TC.TaskID>, Readonly<Tree.Node.Runnable>>;

    private workspaceDetail?: Readonly<{ total: number; displayed: number; }>;
    private pruneDetails?: Map<TC.File, Readonly<{ total: number; displayed: number; }>>;


    /** @param deps Зависимости, предоставляемые владельцем провайдера. */
    constructor(
        private readonly deps: {
            /** Текущее состояние процессов задачи. */
            readonly getRuntime_cb: (taskId: TC.TaskID) => Readonly<TC.RuntimeState> | undefined,
            /** Конфигурация отображения узлов для заданного файла задач. */
            readonly getResourceSettings_cb: (taskFile: TC.File) => Readonly<TC.ScopedSettings>,
            readonly getTaskDetail_cb: (taskId: TC.TaskID) => string | undefined,
        }
    ) { }


    dispose() {

        this.onDidChangeEmitter.dispose();

        this.runnablesMap?.clear();
        this.runnablesMap = undefined;

        this.pruneDetails?.clear();
        this.pruneDetails = undefined;

        // #region DEBUG
        log(LogLevel.Debug, 'disposed');
        // #endregion DEBUG
    }


    // #region Public


    /** Полностью перестроить дерево.
     *
     * @affects
     * Фильтрует скрытые корни, затем для каждого оставшегося
     * удаляет скрытые ноды (если `showHidden` выключен) и пустые
     * промежуточные узлы.
     *
     * @param roots Новые корневые узлы. `undefined` очищает дерево.
     * @fires onDidChangeTreeData */
    public rebuild(roots?: ReadonlyArray<Readonly<Tree.Node.RootNodeWorkspace | Tree.Node.RootNodeFolder>>): TC.WorkspaceDetail {
        // #region DEBUG
        log(LogLevel.Debug, 'Rebuilding entire tree view ...');
        // #endregion DEBUG

        const total = roots?.length ?? 0;
        const _roots = roots ? roots.filter((r) => !r.hide) : [];

        this.pruneDetails = new Map<TC.File, { total: number; displayed: number; }>();

        // Вычистить скрытые задачи, если нужно
        for (const root of _roots) {
            const { showHidden } = this.deps
                .getResourceSettings_cb(root.tasksFile)
                .branchConfig;

            const details = this.pruneBranch(root, showHidden);

            this.pruneDetails.set(root.tasksFile, details);

            if (root.children.length < 1) {
                // если корень был/становиться пустой
                root.children.push(Tree.Node.makeEmptyMarker(root.tasksFile));
            }
        }

        this.workspaceDetail = { total, displayed: _roots.length };

        this.roots = [..._roots];

        this.onDidChangeEmitter.fire();

        return this.workspaceDetail;
    }

    /** Рекурсивно вычистить ветку: удалить скрытые ноды (при `removeHidden`)
     * и промежуточные узлы, оставшиеся без потомков, и не являющиеся Runnable+не скрытыми.
     *
     * Отростки:
     * - Branch, нет детей → полное удаление.
     * - Runnable + Branch, +видимый, но все дети вырезаны → остаётся как Runnable.
     * - Runnable + Branch, +скрытый, дети выжили → становится чистой папкой.
     * - Runnable + Branch, +скрытый, дети не выжили → полное удаление.
     *
     * @returns { total: number; displayed: number; }
     *   - `total` — все Runnable в поддереве (включая скрытые/удалённые)
     *   - `displayed` — только выжившие после отсечения */
    private pruneBranch(
        root: Tree.Node.RootNodeWorkspace | Tree.Node.RootNodeFolder,
        showHidden: boolean
    ): { total: number; displayed: number; } {

        const removeHidden = !showHidden;

        let total = 0;
        let displayed = 0;

        const prune = (node: Tree.Node.RootNodeWorkspace | Tree.Node.RootNodeFolder | Tree.Node.Runnable | Tree.Node.Segment) => {
            node.children = node.children?.filter((child) => {

                if (Tree.Node.isBranch(child)) {
                    // есть дети, но возможно и Runnable
                    prune(child); // рекурсия по потомкам
                }
                if (Tree.Node.isRunnable(child)) {
                    total++;
                    if (child.hidden && removeHidden) {
                        // Если узел имеет потомков — теперь будет отображаться как
                        // чистый сегмент (true). Или будет полностью исключен (false).
                        return Tree.Node.switchToBranch(child);
                    }
                    displayed++;
                    return true; // видимый Runnable — оставить, даже без детей
                }
                // чистый Segment — оставить только если есть потомки
                // Если рекурсия вычистила всех потомков — удаляется
                return !!child.children.length;
            });

        };

        prune(root);

        return { total, displayed };
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

            return this.roots;
        }

        return node.children;
    }


    /** Строит `TreeItem` для заданного узла дерева.
     *
     * Для `Runnable`-узлов попутно регистрирует их в {@linkcode runnablesMap},
     * обеспечивая возможность последующего точечного обновления. */
    public getTreeItem(node: Tree.Node.NodeType): vscode.TreeItem {

        if (Tree.Node.isRoot(node)) {
            if (Tree.Node.isWorkspace(node)) {
                return Renderer.workspace(node);
            }
            else if (Tree.Node.isFolder(node)) {
                return Renderer.folder(node);
            }
            else if (Tree.Node.isFavorites(node)) {
                return Renderer.favorites(node);
            }
            // #region DEBUG
            const _node: never = node;
            throw _node;
            // #endregion DEBUG
        }

        if (Tree.Node.isMarker(node)) {
            return Renderer.marker(node);
        }

        const taskFile = Tree.Node.resolveScope(node);

        if (Tree.Node.isRunnable(node)) {

            const taskId = node.id;
            this.runnablesMap!.set(taskId, node); // @todo: не set если уже есть и === node

            return Renderer.runnable(node, this.deps.getResourceSettings_cb(taskFile).nodeConfig, this.deps.getRuntime_cb(taskId));
        }

        return Renderer.intermediate(node, this.deps.getResourceSettings_cb(taskFile).nodeConfig);


        // #region DEBUG
        throw node;
        // #endregion DEBUG

    }


    /** Дополняет `TreeItem` данными, вычисляемыми лениво (tooltip).
     *
     * Вызывается VS Code при раскрытии или наведении на узел. */
    public resolveTreeItem(item: vscode.TreeItem, node: Tree.Node.NodeType, token: vscode.CancellationToken): vscode.TreeItem {

        if (token.isCancellationRequested) {
            return item;
        }

        if (Tree.Node.isRoot(node)) {
            if (Tree.Node.isFavorites(node)) {
                return item;
            }
            else if (Tree.Node.isWorkspace(node)) {
                return Resolver.workspace(item, node, this.workspaceDetail!, this.pruneDetails?.get(node.tasksFile)!, token);
            }
            else if (Tree.Node.isFolder(node)) {
                return Resolver.folder(item, node, this.pruneDetails?.get(node.tasksFile)!, token);
            }
            // #region DEBUG
            const _node: never = node;
            throw _node;
            // #endregion DEBUG
        }

        if (Tree.Node.isRunnable(node)) {
            return Resolver.runnable(item, node, this.deps.getTaskDetail_cb(node.id), token);
        }

        return item;
    }

    // #endregion Public

}
