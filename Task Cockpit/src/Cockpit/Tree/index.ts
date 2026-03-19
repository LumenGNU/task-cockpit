/** @file Cockpit/Tree/index.ts */
/** @module Tree */

import type * as TC from '../../types';
import helpers from '../../helpers';
import Builder from './Builder';
import Roots from './Roots';


namespace Tree {

    export type RootNode = Roots.RootNode;
    // export type SproutResult = Roots.SproutResult;


    /** Пространство типов для узлов дерева задач.
     *
     * Дерево строится из корневых узлов ({@linkcode WorkspaceRoot}, {@linkcode FolderRoot}),
     * внутренних сегментов ({@linkcode Segment}), узлов задач ({@linkcode Runnable})
     * и визуальных маркеров ({@linkcode Marker}). */
    export namespace Node {

        // Корни

        /** Корневой узел workspace-scope (`.code-workspace`).
         * Содержит дополнительную информацию об исключении и статистику workspace задач. */
        export type WorkspaceRoot = Omit<Roots.RootNode, 'kind'> & {
            kind: 'Workspace';
        };


        /** Корневой узел folder-scope (`.vscode/tasks.json`). */
        export type FolderRoot = Omit<Roots.RootNode, 'kind'> & {
            kind: 'Folder';
        };


        /** Запускаемый узел (задача). Может одновременно быть запускаемой задачей и группой,
         * содержащей дочерние узлы (например, compound task с зависимостями). */
        export type Runnable = Builder.DataNode<TC.TaskDefinition, TC.File>;


        /** Промежуточный сегмент пути без привязанной задачи.
         * Создаётся автоматически при разбиении label по separator. */
        export type Segment = Builder.InternodeNode<TC.TaskDefinition, TC.File>;


        // /** Визуальный маркер. Нефункциональный узел для отображения состояний. */
        // export interface Marker extends Roots.MarkerNode { }

        /** Объединённый тип всех возможных узлов дерева. */
        export type NodeType =
            | WorkspaceRoot
            | FolderRoot
            | Segment
            | Runnable;
        // | Marker;

    }
}


// /** Type guard: узел является визуальным маркером. */
// function isMarker(node: Tree.Node.NodeType): node is Tree.Node.Marker {
//     return 'markerType' in node;
// }


/** Проверяет, содержит ли TaskNode дочерние узлы (является группой). */
function isBranch(node: Tree.Node.Runnable): boolean {
    return Builder.Node.isBranch(node);
}


/** Проверяет, что узел является запускаемой задачей.
 * Отсекает корни, маркеры и промежуточные сегменты без привязанных данных задачи. */
function isRunnable(node: Tree.Node.NodeType): node is Tree.Node.Runnable {
    return 'id' in node;
}


/** Type guard: узел является корневым (workspace или folder root). */
function isRoot(node: Tree.Node.NodeType): node is Tree.Node.WorkspaceRoot | Tree.Node.FolderRoot {
    return 'kind' in node;
}


/** Type guard: корневой узел относится к workspace-scope (`.code-workspace`). */
function isWorkspaceRootNode(node: Tree.Node.WorkspaceRoot | Tree.Node.FolderRoot): node is Tree.Node.WorkspaceRoot {
    return node.kind === 'Workspace';
}


/** Type guard: корневой узел относится к folder-scope (`tasks.json`). */
function isFolderRootNode(node: Roots.RootNode): node is Tree.Node.FolderRoot {
    return node.kind === 'Folder';
}


type ConfigurableType = Tree.Node.Segment | Tree.Node.Runnable;


/** Type guard: узел поддерживает scoped-настройки отображения (сегмент или задача, не корень и не маркер). */
function isConfigurable(node: Tree.Node.NodeType): node is ConfigurableType {
    return 'nodePath' in node;
}


/** Разбирает `nodePath` на scope (файл задач) и массив сегментов пути.
 *
 * `nodePath` имеет формат `<tasksFile><SEP><seg1><SEP><seg2>...<SEP><segment>`,
 * где первый элемент — scope (Task.File), остальные — сегменты иерархии. */
function parseNodePath(node: Tree.Node.Runnable | Tree.Node.Segment): { taskFile: TC.File, segments: string[]; } {
    const [scope, ...segments] = Builder.parsePath(node);
    return { taskFile: scope, segments };
}


/** Извлекает scope (файл задач) из любого узла дерева.
 * Для корней и маркеров — напрямую из `tasksFile`, для остальных — через {@link parseNodePath}. */
function resolveScope(node: Tree.Node.NodeType): TC.File {
    if ('nodePath' in node) {
        return parseNodePath(node).taskFile;
    }
    // if ('kind' in node) {
    //     const aaa = node.children.at(0)!;
    //     if ('nodePath' in aaa) {
    //         return parseNodePath(aaa).taskFile;
    //     }
    //     return aaa.tasksFile;
    // }
    return node.tasksFile;
}


// function resolveId(node: Tree.Node.Runnable): TC.TaskID {
//     return node.data;
// }


const Tree = {
    Node: {
        // resolveId,
        isBranch,
        isConfigurable,
        isFolderRootNode,
        // isMarker,
        isRoot,
        isRunnable,
        isWorkspaceRootNode,
        parseNodePath,
        resolveScope,
    },
    sproutRoots: Roots.sprout
} as const;


export default Tree;
