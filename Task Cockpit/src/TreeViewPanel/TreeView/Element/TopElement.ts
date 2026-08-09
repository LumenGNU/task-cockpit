import {
    ThemeIcon,
    TreeItem,
    TreeItemCollapsibleState,
    type CancellationToken,
    Uri
} from 'vscode';
import formatTooltip from '../formatTooltip';
import type ContextValue from '../ContextValue';
import ElementType from '../ElementType';
import RunnableElement from './RunnableElement';
import IntermediateElement from './IntermediateElement';
import ScopeKey from '../../../ScopeKey';
import Immutable from '../../../utils/Immutable';


interface TopElement {
    type: ElementType.TopElement;
    label: string;
    resourceUri: Uri | null;
    branchKey: ScopeKey;
    detail: {
        total: number;
        hiddenCount: number;
    };
    children: Array<RunnableElement | IntermediateElement>;
};


function create(
    label: TopElement['label'],
    branchKey: TopElement['branchKey'],
    resourceUri: Immutable<TopElement['resourceUri']>,
    children: Immutable<TopElement['children']>,
    detail: Immutable<TopElement['detail']>,
): Immutable<TopElement> {
    return {
        type: ElementType.TopElement,
        label,
        resourceUri,
        branchKey,
        detail,
        children,
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
        }),
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
        element.branchKey === ScopeKey.GLOBAL_KEY
            ? 'Global'
            : element.branchKey === ScopeKey.WORKSPACE_KEY
                ? 'Workspace'
                : 'Folder';

    item.tooltip = formatTooltip(
        scopeType,
        element.label || '<unnamed>',
        element.detail ? `$(tools) Tasks: ${formatTasksSummary(element.detail)}` : undefined
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
function formatTasksSummary(stats: { total: number; hiddenCount: number; }): string {

    if (stats.total === 0) {
        return '*None in this scope*';
    }

    const displayed = stats.total - stats.hiddenCount;

    if (displayed === 0) {
        return `*All hidden* (hidden: \`${stats.total}\`)`;
    }

    if (stats.hiddenCount > 0) {
        return `\`${displayed}\` (hidden: \`${stats.hiddenCount}\`)`;
    }

    return `\`${stats.total}\``;
}

function buildContextValue(branchKey: ScopeKey): ContextValue.Section {

    if (branchKey === ScopeKey.GLOBAL_KEY) {
        return `task-cockpit:Section:Global:Group` satisfies ContextValue.Section;
    }
    else if (branchKey === ScopeKey.WORKSPACE_KEY) {
        return `task-cockpit:Section:Workspace:Group` satisfies ContextValue.Section;;
    }

    return `task-cockpit:Section:Folder:Group` satisfies ContextValue.Section;
}


function getIcon(branchKey: ScopeKey): ThemeIcon {

    if (branchKey === ScopeKey.GLOBAL_KEY) {
        return new ThemeIcon('account');
    }
    else if (branchKey === ScopeKey.WORKSPACE_KEY) {
        return new ThemeIcon('layers');
    }

    return new ThemeIcon('root-folder');

}


const TopElement = {
    create,
    resolveTreeItem,
    createTreeItem
} as const;


export default TopElement;
