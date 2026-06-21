import {
    ThemeIcon,
    TreeItem,
    TreeItemCollapsibleState,
    type CancellationToken,
    type Uri
} from 'vscode';
import formatTooltip from '../formatTooltip';
import type ScopeKey from '../../Scope/Key';
import WorkspaceKey from '../../Scope/Workspace/Key';
import type ContextValue from '../ContextValue';
import ElementType from '../ElementType';
import HierarchyElement from '../../HierarchyModel/HierarchyElement';



interface Element {
    type: ElementType.ScopeSection;
    label: string;
    resourceUri: Uri;
    id: ScopeKey;
    /** (*) Область, отображаемая этой веткой */
    scopeKey: ScopeKey;
    detail: Readonly<{
        total: number;
        hiddenCount: number;
    }>;
    children: ReadonlyArray<HierarchyElement>;
};


function create(
    scopeKey: ScopeKey,
    label: string,
    resourceUri: Uri,
    children: Element['children'],
    detail: Element['detail'],
): Readonly<Element> {
    return {
        type: ElementType.ScopeSection,
        label,
        resourceUri,
        id: scopeKey,
        scopeKey,
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
function getTreeItem(element: Readonly<Element>): TreeItem {

    return {
        collapsibleState: TreeItemCollapsibleState.Expanded, // @todo
        contextValue: buildContextValue(element.id),
        description: false,
        iconPath: getIcon(element.id),
        id: element.id,
        label: element.label,
        resourceUri: element.resourceUri,
    } as const;
};


/** Дополняет элемент-секцию всплывающей подсказкой.
 *
 * Вызывается средой лениво.
 *
 * Если операция отменена, возвращает элемент без изменений. */
function resolveTreeItem(
    item: TreeItem,
    element: Readonly<Element>,
    token: Readonly<CancellationToken>
): Readonly<TreeItem> {

    if (token.isCancellationRequested) {
        return item;
    }

    item.tooltip = formatTooltip(
        element.scopeKey === WorkspaceKey ? 'Workspace Scope' : 'Scope',
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
function formatTasksSummary(stats: Readonly<{ total: number; hiddenCount: number; }>): string {

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

function buildContextValue(scopeKey: ScopeKey): ContextValue.Section {
    // @todo global

    if (scopeKey === WorkspaceKey) {
        return `task-cockpit:Section:Workspace:Group` satisfies ContextValue.Section;
    }

    return `task-cockpit:Section:Folder:Group` satisfies ContextValue.Section;
}


function getIcon(scopeKey: ScopeKey): ThemeIcon {

    // @todo global

    if (scopeKey === WorkspaceKey) {
        return new ThemeIcon('layers');
    }

    return new ThemeIcon('root-folder');

}


const Element = {
    create,
    resolveTreeItem,
    getTreeItem
} as const;


export default Element;
