import {
    ThemeIcon,
    ThemeColor,
    TreeItem,
    TreeItemCollapsibleState,
    type CancellationToken,
    Uri
} from 'vscode';
import formatTooltip from '../formatTooltip';
import PinsKey from '../../Pins/Key';
import type ContextValue from '../ContextValue';
import type UriSchema from '../../DecorationProvider/UriSchema';
import ElementType from '../ElementType';
import type HierarchyElement from '../../HierarchyModel/HierarchyElement';
import type ScopeKey from '../../Scope/Key';

interface Element {
    type: ElementType.PinsSection,
    id: PinsKey;
    children: ReadonlyMap<ScopeKey, ReadonlyArray<HierarchyElement>>;
};


function create(children: ReadonlyMap<ScopeKey, ReadonlyArray<HierarchyElement>>): Readonly<Element> {
    return {
        type: ElementType.PinsSection,
        id: PinsKey,
        children
    } as const;
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
        contextValue: buildContextValue(),
        description: false,
        iconPath: getIcon(),
        id: element.id,
        label: 'Pins',
        resourceUri: Uri.from({
            scheme: 'task-cockpit',
            authority: 'Node',
            path: '',
        } satisfies UriSchema),
    } as const;
};


/** Дополняет элемент-секцию всплывающей подсказкой.
 *
 * Вызывается средой лениво.
 *
 * Если операция отменена, возвращает элемент без изменений. */
function resolveTreeItem(
    item: TreeItem,
    _element: Readonly<Element>,
    token: Readonly<CancellationToken>
): TreeItem {

    if (token.isCancellationRequested) {
        return item;
    }

    item.tooltip = formatTooltip(
        'Section',
        'Pins',
        undefined
    );

    return item;
};


function getIcon(): ThemeIcon {
    return new ThemeIcon('pin', new ThemeColor('list.list.activeSelectionBackground')); // @fixme
}


function buildContextValue(): ContextValue.Section {
    return `task-cockpit:Section:Pins:Group`;
}


const Element = {
    create,
    resolveTreeItem,
    getTreeItem
} as const;


export default Element;
