/** @file TreeViewPanel/TreeView/Element/EmptyElement.ts */

import {
    ThemeColor,
    ThemeIcon,
    TreeItemCollapsibleState,
    Uri
} from 'vscode';
import { UI } from '../../../common';
import formatTooltip from '../formatTooltip';

import type {
    CancellationToken,
    TreeItem
} from 'vscode';
import type ContextValue from '../ContextValue';
import type Immutable from '../../../utils/Immutable';
import type UriQuery from '../../../FileDecorationProvider/UriQuery';
import type UriSchema from '../../../FileDecorationProvider/UriSchema';


/** Узел-заглушка — отображается внутри секции,
 * когда секция пуста. */
interface Element {
    kind: 'EmptyNode';
    // /** (*) Область, отображаемая этой веткой */
    // scopeKey: ScopeKey;
    /** (*) Уникальный id узла в дереве */
    id: string;
    cause: 'Hidden' | 'Empty';
};


function create(
    id: string,
    // scopeKey: ScopeKey,
    detail: Readonly<{
        totalCount: number;
        hiddenCount: number;
        shadowedCount: number;
    }> | undefined
): Immutable<Element> {

    return {
        kind: 'EmptyNode',
        // scopeKey,
        id,
        cause: detail
            ? detail.totalCount > 0 && detail.hiddenCount === detail.totalCount
                ? 'Hidden'
                : 'Empty'
            : 'Empty'
    } satisfies Element;
}


/** Создаёт {@linkcode TreeItem} для узла-заглушки.
 *
 * Иконка: `-`
 * Состояние: лист
 * `contextValue`: `task-cockpit:Node:Special:(Empty|Hidden)` */
function createTreeItem(element: Immutable<Element>): TreeItem {

    return {
        id: element.id,
        label: 'No tasks to display in this scope',
        description: false,
        iconPath: new ThemeIcon(UI.ICON.DEEMPHASIZED, new ThemeColor(UI.COLOR.DEEMPHASIZED)),
        collapsibleState: TreeItemCollapsibleState.None,
        contextValue: `:Node:Special:${element.cause}` satisfies ContextValue.Node.Special,
        resourceUri: Uri.from({
            scheme: 'task-cockpit',
            authority: 'Node',
            path: '',
            query: (new URLSearchParams({
                tintColor: UI.COLOR.DEEMPHASIZED
            } satisfies UriQuery)).toString()
        } satisfies UriSchema)
    };
}


function resolveTreeItem(
    item: TreeItem,
    element: Immutable<Element>,
    token: CancellationToken
): TreeItem {

    if (token.isCancellationRequested) {
        return item;
    }

    item.tooltip = formatTooltip(
        'Empty Scope',
        undefined,
        (element.cause === 'Hidden')
            ? '*All tasks hidden by active filters*'
            : '*No tasks in this scope*'
    );

    return item;
}


const Element = {
    create,
    resolveTreeItem,
    createTreeItem
} as const;


export default Element;
