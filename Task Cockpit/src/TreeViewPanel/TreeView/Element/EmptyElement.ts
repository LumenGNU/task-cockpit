import {
    ThemeColor,
    ThemeIcon,
    TreeItemCollapsibleState,
    type CancellationToken,
    type TreeItem,
    Uri,
} from 'vscode';
import formatTooltip from '../formatTooltip';
import ElementType from '../ElementType';
import type ContextValue from '../ContextValue';
import type UriSchema from '../../../DecorationProvider/UriSchema';
import type UriQuery from '../../../DecorationProvider/UriQuery';
import type Immutable from 'src/utils/Immutable';


/** Узел-заглушка — отображается внутри секции,
 * когда секция пуста. */
interface Element {
    type: ElementType.EmptyNode;
    // /** (*) Область, отображаемая этой веткой */
    // scopeKey: ScopeKey;
    /** (*) Уникальный id узла в дереве */
    id: string;
    cause: 'Hidden' | 'Empty';
};


function create(
    id: string,
    // scopeKey: ScopeKey,
    detail: Readonly<{ total: number; hiddenCount: number; }> | undefined
): Immutable<Element> {

    return {
        type: ElementType.EmptyNode,
        // scopeKey,
        id,
        cause: detail
            ? detail.total > 0 && detail.hiddenCount === detail.total
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
        iconPath: new ThemeIcon('dash', new ThemeColor('list.deemphasizedForeground')),
        collapsibleState: TreeItemCollapsibleState.None,
        contextValue: `task-cockpit:Node:Special:${element.cause}` satisfies ContextValue.Node.Special,
        resourceUri: Uri.from({
            scheme: 'task-cockpit',
            authority: 'Node',
            path: '',
            query: (new URLSearchParams({
                tintColor: 'list.deemphasizedForeground'
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
