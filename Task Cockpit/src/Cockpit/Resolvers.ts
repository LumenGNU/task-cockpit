/** @file Cockpit/Resolvers.ts */
/** @module Resolvers */

import * as vscode from 'vscode';
import Tree from './Tree';


/** Резолвит {@link vscode.TreeItem} для корневого узла —
 * добавляет Markdown-тултип со сводкой по папкам и задачам. */
function workspace(
    item: vscode.TreeItem,
    node: Tree.Node.RootNodeWorkspace,
    workspaceDetail: Readonly<{ total: number; displayed: number; }>,
    pruneDetails: Readonly<{ total: number; displayed: number; }>,
    token: vscode.CancellationToken
): vscode.TreeItem {

    if (token.isCancellationRequested) {
        return item;
    }

    const foldersDetail = formatFoldersDetail(workspaceDetail);

    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = false;
    tooltip.supportHtml = false;
    tooltip.supportThemeIcons = true;

    tooltip.appendMarkdown(
        `**${node.segment}**  \n` +
        `${foldersDetail ? `$(root-folder) Folders: ${foldersDetail}  \n` : ''}` +
        `$(tools) Tasks: ${formatTasksDetail(pruneDetails)}  \n` +
        '\u00A0'
    );

    item.tooltip = tooltip;
    return item;
}


/** Резолвит {@link vscode.TreeItem} для корневого узла папки —
 * добавляет Markdown-тултип со сводкой по задачам внутри папки. */
function folder(
    item: vscode.TreeItem,
    node: Tree.Node.RootNodeFolder,
    pruneDetails: Readonly<{ total: number; displayed: number; }>,
    token: vscode.CancellationToken
): vscode.TreeItem {

    if (token.isCancellationRequested) {
        return item;
    }

    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = false;
    tooltip.supportHtml = false;
    tooltip.supportThemeIcons = true;

    tooltip.appendMarkdown(
        `**${node.segment}** (*folder*)  \n` +
        `$(tools) Tasks: ${formatTasksDetail(pruneDetails)}  \n` +
        '\u00A0'
    );

    item.tooltip = tooltip;
    return item;
}




/** Резолвит {@link vscode.TreeItem} для запускаемой задачи —
 * добавляет Markdown-тултип с происхождением задачи (project / workspace),
 * сегментом label и {@link vscode.Task.detail detail}, если есть. */
function runnable(item: vscode.TreeItem, node: Tree.Node.Runnable, taskDetail: string | undefined, token: vscode.CancellationToken): vscode.TreeItem {

    if (token.isCancellationRequested) {
        return item;
    }

    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = false;
    tooltip.supportHtml = false;
    tooltip.supportThemeIcons = true;

    const taskFile = Tree.Node.resolveScope(node);

    tooltip.appendMarkdown(
        `${(`*${taskFile.endsWith('.code-workspace') ? 'Workspace' : 'Project'} Task*`).padEnd(48, '\u00A0')}\n\n` +
        `**${node.segment}**  \n` +
        (taskDetail ?? '')
    );

    item.tooltip = tooltip;
    return item;
}



/** Форматирует человекочитаемую сводку видимости папок для тултипа.
 *
 * Обрабатывает четыре случая:
 * - Нет папок в скоупе
 * - Все папки исключены
 * - Часть папок исключена (показывает видимые и исключённые)
 * - Нет исключений (показывает общее количество) */
function formatFoldersDetail(workspaceDetail: Readonly<{ total: number; displayed: number; }>): string {

    // No folders in this scope at all
    if (workspaceDetail.total === 0) {
        return `*Workspace contains no folders*`;
    }

    // All folders in this scope are excluded
    if (workspaceDetail.displayed === 0) {
        return `*All excluded* (excludes: \`${workspaceDetail.total}\`)`;
    }

    // Some folders are excluded
    if (workspaceDetail.displayed < workspaceDetail.total) {
        return `\`${workspaceDetail.displayed}\` (excludes: \`${workspaceDetail.total - workspaceDetail.displayed}\`)`;
    }

    // No excluded folders
    return `\`${workspaceDetail.total}\``;
}


/** Форматирует человекочитаемую сводку видимости задач для тултипа.
 *
 * Обрабатывает пять случаев:
 * - Весь скоуп исключён из отображения
 * - Нет задач в скоупе
 * - Все задачи скрыты
 * - Часть задач скрыта (показывает видимые и скрытые)
 * - Нет скрытых задач (показывает общее количество)
 *
 * @param excluded - Если `true`, весь скоуп исключён из отображения
 *   (используется workspace root, когда папка отфильтрована). */
function formatTasksDetail(pruneDetails: Readonly<{ readonly total: number; readonly displayed: number; }>): string {

    // No tasks in this scope at all
    if (pruneDetails.total === 0) {
        return `*None in this scope*`;
    }

    // All tasks in this scope are hidden
    if (pruneDetails.displayed === 0) {
        return `*All hidden* (hidden: \`${pruneDetails.total}\`)`;
    }

    // Some tasks are hidden
    if (pruneDetails.displayed < pruneDetails.total) {
        return `\`${pruneDetails.displayed}\` (hidden: \`${pruneDetails.total - pruneDetails.displayed}\`)`;
    }

    // No hidden tasks
    return `\`${pruneDetails.total}\``;
}


/** Резолверы тултипов для типов узлов дерева.
 *
 * Вызываются из {@linkcode vscode.TreeDataProvider.resolveTreeItem | resolveTreeItem}
 * для ленивого заполнения тултипов при наведении. */
const Resolver = {
    folder,
    workspace,
    runnable
} as const;


export default Resolver;
