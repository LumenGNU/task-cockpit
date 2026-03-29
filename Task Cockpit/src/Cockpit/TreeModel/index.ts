/** @file Cockpit/TreeModel/index.ts */
/** @module Tree */

import type * as TC from '../../types';
import Hierarchy from './Hierarchy';
import FolderRoots from './Folders';


declare namespace TreeModel {


    /** Пространство типов для узлов дерева задач.
     *
     * Дерево строится из корневых узлов ({@linkcode WorkspaceRoot}, {@linkcode FolderRoot}),
     * внутренних сегментов ({@linkcode Segment}), узлов задач ({@linkcode Runnable})
     * и визуальных маркеров ({@linkcode Marker}). */
    export namespace Node {

        // Корни

        // /** Корневой узел workspace-scope (`.code-workspace`).
        //  * Содержит дополнительную информацию об исключении и статистику workspace задач. */
        // export type RootNodeWorkspace = {
        //     kind: 'Workspace';
        // } & Omit<Roots.RootNode, 'kind'>;


        // /** Корневой узел folder-scope (`.vscode/tasks.json`). */
        // export type RootNodeFolder = {
        //     kind: 'Folder';
        // } & Omit<Roots.RootNode, 'kind'>;


        export type RootNodeFavorites = {
            kind: 'Favorites';
            children: TaskNode[];
        };


        export type TaskNode = Hierarchy.Node<TC.TaskDefinition, TC.File>;


        export type RootNode =
            | FolderRoots.RootNodeFolder
            | RootNodeFavorites;


        export type ChildrenNode =
            | TaskNode;


        /** Объединённый тип всех возможных узлов дерева. */
        export type NodeType =
            | RootNode
            | ChildrenNode;

    }


}



/** Type guard: узел является корневым (workspace или folder root). */
function isRoot(node: TreeModel.Node.NodeType): node is TreeModel.Node.RootNode {
    return 'kind' in node;
}


/** Проверяет, содержит ли TaskNode дочерние узлы (является группой). */
function isBranch(node: TreeModel.Node.NodeType): boolean {
    if (isRoot(node)) {
        return true;
    }
    return Hierarchy.Node.isBranch(node);
}


/** Проверяет, что узел является action-узлом.
 * Отсекает корни, маркеры и промежуточные сегменты без привязанных данных задачи. */
function isRunnable(node: TreeModel.Node.NodeType): boolean {
    if (isRoot(node)) {
        return false;
    }
    return Hierarchy.Node.isData(node);
}


function isFolder(node: TreeModel.Node.RootNode): node is TreeModel.Node.RootNodeFolder {
    return node.kind === 'Folder';
}

function isWorkspace(node: TreeModel.Node.RootNode): node is TreeModel.Node.RootNodeWorkspace {
    return node.kind === 'Workspace';
}

function isFavorites(node: TreeModel.Node.RootNode): node is TreeModel.Node.RootNodeFavorites {
    return node.kind === 'Favorites';
}

/** Разбирает `nodePath` на scope (файл задач) и массив сегментов пути. */
function parseNodeURI(node: TreeModel.Node.NodeType): Readonly<TC.NodeURI> {

    if (isRoot(node)) {
        return {
            authority: node.kind,
            path: isFavorites(node) ? '/' : node.tasksFile,
            fragment: undefined,
        };
    }

    const { scopeId, segments } = Hierarchy.Node.resolvePath(node);

    return {
        authority: isRunnable(node) ? 'Runnable' : 'Group',
        path: scopeId,
        fragment: segments.join('\0'),
    };
}





const TreeModel = {
    Node: {
        isBranch,
        isFavorites,
        isFolder,
        isRoot,
        isRunnable,
        isWorkspace,
    },
} as const;


export default TreeModel;
