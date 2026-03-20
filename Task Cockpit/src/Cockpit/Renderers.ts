/** @file Cockpit/Renderers.ts */
/** @module Renderers */

import * as vscode from 'vscode';
import * as TC from '../types';
import helpers from '../helpers';
import Tree from './Tree';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { assert } = Logger.get(module.filename);
// #endregion DEBUG


/** Создаёт {@linkcode vscode.TreeItem} для корневого узла (workspace).
 *
 * Отображается как развёрнутый узел с иконкой `layers`. */
function workspace(node: Tree.Node.RootNodeWorkspace): vscode.TreeItem {

    return {
        label: node.segment,
        resourceUri: vscode.Uri.file(node.tasksFile),
        iconPath: new vscode.ThemeIcon('layers'),
        contextValue: 'task-cockpit:Folder:Workspace',
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded
    };
}


/** Создаёт {@linkcode vscode.TreeItem} для корневого узла (folder).
 *
 * Всегда развёрнут; иконка — `root-folder`. */
function folder(node: Tree.Node.RootNodeFolder): vscode.TreeItem {

    return {
        label: node.segment,
        resourceUri: vscode.Uri.file(node.tasksFile),
        iconPath: new vscode.ThemeIcon('root-folder'),
        contextValue: 'task-cockpit:Folder:Project',
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded
    };
}


function favorites(node: Tree.Node.RootNodeFavorites): vscode.TreeItem {
    return {
        label: 'XXXXXXXZZZZZZZZZZZYYYYYYYYYY',
        resourceUri: vscode.Uri.from({
            scheme: 'task-cockpit',
            authority: 'favorites',
            path: '/'
        }),
        iconPath: new vscode.ThemeIcon('pinned'),
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        contextValue: 'task-cockpit:Folder:Pinned'
    };
}


/** Создаёт {@linkcode vscode.TreeItem} для узла-маркера (placeholder).
 *
 * На данный момент поддерживается только тип 'EMPTY' —
 * отображает приглушённую строку «No tasks to display in this scope»,
 * когда в области нет видимых задач.
 *
 * `resourceUri` с кастомной схемой `task-cockpit:` используется
 * для передачи параметров декорации через query-компонент. */
function marker(node: Tree.Node.Marker): vscode.TreeItem {

    return {
        resourceUri: vscode.Uri.from({
            scheme: 'task-cockpit',
            authority: 'marker',
            path: node.nodePath,
            query:
                helpers.encodeQueryComponent({
                    color: 'list.deemphasizedForeground',
                    special: node.markerType
                })
        }),
        iconPath: new vscode.ThemeIcon('dash', new vscode.ThemeColor('list.deemphasizedForeground')),
        label: node.segment,
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        tooltip: new vscode.MarkdownString(`*${node.segment}*\n`, false),
        contextValue: 'task-cockpit:Marker'
    };

}


/** Создаёт {@link vscode.TreeItem} для запускаемой задачи.
 *
 * Отвечает за:
 * - **Иконку** — берётся из определения задачи (`icon.id`, `icon.color`)
 *   или используется `defaultIconName` из конфигурации области.
 * - **Статус** — количество процессов и запущенных экземпляров кодируется
 *   в `resourceUri` (query-компонент) для {@link DecorationProvider декоратора},
 *   а также определяет `contextValue` для контекстного меню
 *   (`:terminals` — есть терминалы, `:running` — есть живые процессы).
 * - **Флаги** — `Hidden`, `Default`, `Background` отображаются в `description`.
 * - **Вложенность** — если узел является ветвью (имеет потомков),
 *   он сворачиваем; иначе — лист.
 *
 * @param scopedConfig Настройки отображения для текущей области (папки).
 * @param runtimeState Карта процессов задачи; `undefined` если задача не запускалась. */
function runnable(
    node: Tree.Node.Runnable,
    scopedConfig: TC.NodeConfig,
    runtimeState: TC.RuntimeState | undefined
): vscode.TreeItem {

    const processes = runtimeState?.size ?? 0;
    const running = processes > 0 ? [...runtimeState!.values()].reduce((n, pInfo) => n + (pInfo.running ? 1 : 0), 0) : 0;

    const contextValue = [
        'task-cockpit:Task',
        processes > 0 ? 'terminals' : false,
        running ? 'running' : false,
        node.rejectFlag ? 'broken' : false
    ].filter((s): s is string => Boolean(s)).join(':');

    const flags = [
        node.hidden ? 'Hidden' : false,
        node.group?.isDefault ? 'Default' : false,
        node.isBackground ? 'Background' : false
    ].filter((s): s is string => Boolean(s));

    return {
        // id: node.nodePath,
        resourceUri: vscode.Uri.from({
            scheme: 'task-cockpit',
            authority: 'task',
            path: node.nodePath,
            query:
                helpers.encodeQueryComponent({
                    color: scopedConfig.tintLabel ? node.icon.color : undefined,
                    processes,
                    running,
                    special: node.rejectFlag ? 'BROKEN' : undefined
                })
        }),
        label: node.segment,
        iconPath: new vscode.ThemeIcon(
            node.icon.id || scopedConfig.defaultIconName,
            node.icon.color ? new vscode.ThemeColor(node.icon.color) : undefined
        ),
        collapsibleState: Tree.Node.isBranch(node) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        description: flags.length > 0 ? `( ${flags.join(', ')} )` : undefined,
        contextValue,
    };
}


/** Создаёт {@linkcode vscode.TreeItem} для промежуточного (не-задачного) узла дерева.
 *
 * Промежуточные узлы появляются при разбиении label по сегментам.
 * Иконка папки отображается только если включена настройка `useFolderIcon`. */
function intermediate(
    node: Tree.Node.Segment,
    scopedConfig: TC.NodeConfig,
): vscode.TreeItem {
    return {
        // id: node.nodePath,
        resourceUri: vscode.Uri.from({
            scheme: 'task-cockpit',
            authority: 'intermediate',
            path: node.nodePath
        }),
        label: node.segment,
        iconPath: scopedConfig.useFolderIcon ? new vscode.ThemeIcon('symbol-folder') : undefined,
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        tooltip: new vscode.MarkdownString(`**${node.segment}** group\n`),
        contextValue: 'task-cockpit:Group',
    };
}


/** Рендереры для создания {@linkcode vscode.TreeItem} из узлов дерева.
 *
 * Вызываются из {@linkcode vscode.TreeDataProvider.getTreeItem | getTreeItem}
 * для первичного построения элементов дерева (без тултипов —
 * тултипы заполняются лениво через {@link Resolver | резолверы}). */
const Renderer = {
    favorites,
    folder,
    intermediate,
    marker,
    runnable,
    workspace,
} as const;

export default Renderer;
