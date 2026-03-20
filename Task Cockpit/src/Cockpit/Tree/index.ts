/** @file Cockpit/Tree/index.ts */
/** @module Tree */

import type * as TC from '../../types';
import Builder from './Builder';
import Roots from './Roots';


namespace Tree {


    /** Пространство типов для узлов дерева задач.
     *
     * Дерево строится из корневых узлов ({@linkcode WorkspaceRoot}, {@linkcode FolderRoot}),
     * внутренних сегментов ({@linkcode Segment}), узлов задач ({@linkcode Runnable})
     * и визуальных маркеров ({@linkcode Marker}). */
    export namespace Node {

        // Корни

        /** Корневой узел workspace-scope (`.code-workspace`).
         * Содержит дополнительную информацию об исключении и статистику workspace задач. */
        export type RootNodeWorkspace = {
            kind: 'Workspace';
        } & Omit<Roots.RootNode, 'kind'>;


        /** Корневой узел folder-scope (`.vscode/tasks.json`). */
        export type RootNodeFolder = {
            kind: 'Folder';
        } & Omit<Roots.RootNode, 'kind'>;


        export type RootNodeFavorites = {
            kind: 'Favorites';
            segment: string;
            children: (Tree.Node.Runnable | Tree.Node.Segment)[];
        };


        /** Запускаемый узел (задача). Может одновременно быть запускаемой задачей и группой,
         * содержащей дочерние узлы (например, compound task с зависимостями). */
        export type Runnable = {
            children?: (Runnable | Segment)[];
        } & Omit<Builder.DataNode<TC.TaskDefinition, TC.File>, 'children'>;


        /** Промежуточный сегмент пути без привязанной задачи.
         * Создаётся автоматически при разбиении label по separator. */
        export type Segment = {
            children: (Runnable | Segment)[];
        } & Omit<Builder.InternodeNode<TC.TaskDefinition, TC.File>, 'children'>;


        // /** Визуальный маркер. Нефункциональный узел для отображения состояний. */
        export type Marker = {
            markerType: 'EMPTY';
            children: never;
        } & Omit<Builder.InternodeNode<TC.TaskDefinition, TC.File>, 'children'>;


        export type RootNode =
            | Tree.Node.RootNodeWorkspace
            | RootNodeFolder
            | RootNodeFavorites;


        export type ChildrenNode =
            | Segment
            | Runnable
            | Marker;


        /** Объединённый тип всех возможных узлов дерева. */
        export type NodeType =
            | RootNode
            | ChildrenNode;

    }


}


/** Type guard: узел является визуальным маркером. */
function isMarker(node: Tree.Node.NodeType): node is Tree.Node.Marker {
    return 'markerType' in node;
}


/** Проверяет, содержит ли TaskNode дочерние узлы (является группой).
 * (~НЕ~ сужает тип @todo ????) */
function isBranch(node: Tree.Node.Runnable | Tree.Node.Segment): boolean { //node is Tree.Node.Segment {
    return ('children' in node) && (node.children !== undefined) && (node.children.length > 0);
}


/** Проверяет, что узел является запускаемой задачей.
 * Отсекает корни, маркеры и промежуточные сегменты без привязанных данных задачи. */
function isRunnable(node: Tree.Node.NodeType): node is Tree.Node.Runnable {
    return 'id' in node;
}


/** Переключает узел в чистый сегмент. (Отбирается возможность быть Runnable)
 * Возвращает `true`, если узел имеет потомков.
 * False — если нет.
 *
 * @affects `id` У узла удаляется свойство `id`. */
function switchToBranch(node: Tree.Node.Runnable): boolean {
    if (isBranch(node)) {
        delete (node as Partial<Tree.Node.Runnable>).id;
        return true;
    } else {
        return false;
    }
}


/** Type guard: узел является корневым (workspace или folder root). */
function isRoot(node: Tree.Node.NodeType): node is Tree.Node.RootNode {
    return 'kind' in node;
}


function isFolder(node: Tree.Node.RootNode): node is Tree.Node.RootNodeFolder {
    return node.kind === 'Folder';
}

function isWorkspace(node: Tree.Node.RootNode): node is Tree.Node.RootNodeWorkspace {
    return node.kind === 'Workspace';
}

function isFavorites(node: Tree.Node.RootNode): node is Tree.Node.RootNodeFavorites {
    return node.kind === 'Favorites';
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
function resolveScope(node: Tree.Node.ChildrenNode | Tree.Node.RootNodeFolder | Tree.Node.RootNodeWorkspace): TC.File {
    if ('nodePath' in node) {
        return parseNodePath(node).taskFile;
    }

    return node.tasksFile;
}


// function resolveId(node: Tree.Node.Runnable): TC.TaskID {
//     return node.data;
// }

function makeEmptyMarker(tasksFile: TC.File): Tree.Node.Marker {
    return {
        markerType: 'EMPTY',
        segment: 'No tasks to display in this scope',
        nodePath: `${tasksFile}\0[[--marker--empty--]]`,
        children: undefined as never,
    };
}


const Tree = {
    Node: {
        isBranch,
        isFavorites,
        isFolder,
        isMarker,
        isRoot,
        isRunnable,
        isWorkspace,
        makeEmptyMarker,
        parseNodePath,
        resolveScope,
        switchToBranch,
    },
    sproutRoots: Roots.sprout
} as const;


export default Tree;
