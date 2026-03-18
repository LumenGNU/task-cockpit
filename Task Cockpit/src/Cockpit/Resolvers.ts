/** @file Cockpit/Resolvers.ts */
/** @module Resolvers */

import * as vscode from 'vscode';
import type * as TC from '../types';
import type Tree from './Tree';


/** Резолвит {@link vscode.TreeItem} для корневого узла —
 * добавляет Markdown-тултип со сводкой по папкам и задачам. */
function workspace(
    item: vscode.TreeItem,
    node: Tree.Node.WorkspaceRoot,
    workspaceDetail: TC.WorkspaceDetail,
    scopedDetail: TC.ScopedDetail,
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
        `$(tools) Tasks: ${formatTasksDetail(scopedDetail)}  \n` +
        '\u00A0'
    );

    item.tooltip = tooltip;
    return item;
}


/** Резолвит {@link vscode.TreeItem} для корневого узла папки —
 * добавляет Markdown-тултип со сводкой по задачам внутри папки. */
function folder(
    item: vscode.TreeItem,
    node: Tree.Node.FolderRoot,
    scopedDetail: TC.ScopedDetail,
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
        `**${node.segment}**  \n` +
        `$(tools) Tasks: ${formatTasksDetail(scopedDetail)}  \n` +
        '\u00A0'
    );

    item.tooltip = tooltip;
    return item;
}


/** Резолвит {@link vscode.TreeItem} для запускаемой задачи —
 * добавляет Markdown-тултип с происхождением задачи (project / workspace),
 * сегментом label и {@link vscode.Task.detail detail}, если есть. */
function runnable(item: vscode.TreeItem, node: Tree.Node.Runnable, task: TC.Task, token: vscode.CancellationToken): vscode.TreeItem {

    if (token.isCancellationRequested) {
        return item;
    }

    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = false;
    tooltip.supportHtml = false;
    tooltip.supportThemeIcons = true;

    tooltip.appendMarkdown(
        `${(`*${task.source.endsWith('.code-workspace') ? 'Workspace' : 'Project'} Task*`).padEnd(48, '\u00A0')}\n\n` +
        `**${node.segment}**  \n` +
        (task.vscTask.detail ?? '')
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
function formatFoldersDetail(detail: TC.WorkspaceDetail): string {

    // No folders in this scope at all
    if (detail.all === 0) {
        return `*Workspace contains no folders*`;
    }

    const visible = detail.all - detail.excludes;

    // All folders in this scope are excluded
    if (visible === 0) {
        return `*All excluded* (excludes: \`${detail.excludes}\`)`;
    }

    // Some folders are excluded
    if (detail.excludes > 0) {
        return `\`${visible}\` (excludes: \`${detail.excludes}\`)`;
    }

    // No excluded folders
    return `\`${detail.all}\``;
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
function formatTasksDetail(detail: TC.ScopedDetail): string {

    // No tasks in this scope at all
    if (detail.all === 0) {
        return `*None in this scope*`;
    }

    const visible = detail.all - detail.hidden;

    // All tasks in this scope are hidden
    if (visible === 0) {
        return `*All hidden* (hidden: \`${detail.hidden}\`)`;
    }

    // Some tasks are hidden
    if (detail.hidden > 0) {
        return `\`${visible}\` (hidden: \`${detail.hidden}\`)`;
    }

    // No hidden tasks
    return `\`${detail.all}\``;
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
