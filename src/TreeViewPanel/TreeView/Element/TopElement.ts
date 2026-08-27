/** @file TreeViewPanel/TreeView/Element/TopElement.ts */

import {
    ThemeIcon,
    TreeItem,
    TreeItemCollapsibleState,
    type CancellationToken,
    Uri
} from 'vscode';
import formatTooltip from '../formatTooltip';
import type ContextValue from '../ContextValue';
import RunnableElement from './RunnableElement';
import IntermediateElement from './IntermediateElement';
import OriginKey from '../../../OriginKey';
import Immutable from '../../../utils/Immutable';
import type OriginNode from '../../OriginNode';
import { UI } from '../../../common';


interface TopElement {
    kind: 'TopNode';
    label: string;
    resourceUri: Uri | null;
    branchKey: OriginKey;
    tasksSummary: {
        totalCount: number;
        hiddenCount: number;
        shadowedCount: number;
    };
    children: Array<RunnableElement | IntermediateElement>;
};


function create(originData: Immutable<OriginNode>): Immutable<TopElement> {
    return {
        kind: 'TopNode',
        label: originData.displayName,
        resourceUri: originData.taskSourceUri,
        branchKey: originData.originKey,
        tasksSummary: originData.taskCounts,
        children: originData.hierarchy.children
    };
}

/** Создаёт {@linkcode TreeItem} для корневого узла области рабочего пространства.
 *
 * Иконка:
 * - `layers` — рабочее пространство
 * - `root-folder` — папка
 *
 * Состояние: всегда развёрнут // @todo
 *
 * `resourceUri` — файл-источник задач (не обязан существовать)
 *
 * `contextValue`: `task-cockpit:Section:Scope:(Global|Workspace|Folder)` */
function createTreeItem(element: Immutable<TopElement>): TreeItem {

    return {
        collapsibleState: TreeItemCollapsibleState.Expanded, // @todo
        contextValue: buildContextValue(element.branchKey),
        description: false,
        iconPath: getIcon(element.branchKey),
        id: element.branchKey,
        label: element.label,
        resourceUri: element.resourceUri ?? Uri.from({
            scheme: 'task-cockpit',
            authority: 'Node',
            path: ''
        })
    } as const;
};


/** Дополняет элемент-секцию всплывающей подсказкой.
 *
 * Вызывается средой лениво.
 *
 * Если операция отменена, возвращает элемент без изменений. */
function resolveTreeItem(
    item: TreeItem,
    element: Immutable<TopElement>,
    token: CancellationToken
): TreeItem {

    if (token.isCancellationRequested) {
        return item;
    }

    const scopeType =
        element.branchKey === OriginKey.USER
            ? 'User'
            : element.branchKey === OriginKey.WORKSPACE
                ? 'Workspace'
                : 'Folder';

    item.tooltip = formatTooltip(
        scopeType,
        element.label || '«unnamed»',
        element.tasksSummary ? `$(${UI.ICON.TASK_DEFAULT}) Tasks: ${formatTasksSummary(element.tasksSummary)}` : undefined
    );

    return item;
};


/** Форматирует краткую сводку по видимости задач
 * для отображения во всплывающей подсказке.
 *
 * Обрабатываются четыре ситуации:
 * - В области нет задач
 * - Все задачи скрыты
 * - Часть задач скрыта (отображается количество видимых и скрытых)
 * - Нет скрытых задач (отображается общее количество) */
function formatTasksSummary(detail: TopElement['tasksSummary']): string {

    if (detail.totalCount === 0) {
        return '*None in this scope*';
    }

    const displayed = detail.totalCount - detail.hiddenCount - detail.shadowedCount;

    const qualifiers: string[] = [];
    if (detail.hiddenCount > 0) {
        qualifiers.push(`hidden: \`${detail.hiddenCount}\``);
    }
    if (detail.shadowedCount > 0) {
        qualifiers.push(`shadowed: \`${detail.shadowedCount}\``);
    }
    const suffix = qualifiers.length > 0 ? ` (${qualifiers.join(', ')})` : '';

    if (displayed === 0) {
        return `*All hidden*${suffix}`;
    }

    return `\`${displayed}\`${suffix}`;
}

function buildContextValue(branchKey: OriginKey): ContextValue.Section {

    if (branchKey === OriginKey.USER) {
        return ':Section:Global:Group' satisfies ContextValue.Section;
    }
    else if (branchKey === OriginKey.WORKSPACE) {
        return ':Section:Workspace:Group' satisfies ContextValue.Section;
    }

    return ':Section:Folder:Group' satisfies ContextValue.Section;
}


function getIcon(branchKey: OriginKey): ThemeIcon {

    if (branchKey === OriginKey.USER) {
        return new ThemeIcon(UI.ICON.USER_ORIGIN);
    }
    else if (branchKey === OriginKey.WORKSPACE) {
        return new ThemeIcon(UI.ICON.WORKSPACE_ORIGIN);
    }

    return new ThemeIcon(UI.ICON.FOLDER_ORIGIN);

}


const TopElement = {
    create,
    resolveTreeItem,
    createTreeItem
} as const;


export default TopElement;
