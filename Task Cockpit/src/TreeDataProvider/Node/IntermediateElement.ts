import {
    ThemeIcon,
    TreeItemCollapsibleState,
    type CancellationToken,
    type TreeItem,
    Uri
} from 'vscode';
import formatTooltip from '../formatTooltip';
import ElementType from '../ElementType';
import type Conf from '../../Configuration/Scoped/Config';
import type ContextValue from '../ContextValue';
import type HierarchyElement from '../../HierarchyModel/HierarchyElement';
import type NodeId from '../NodeId';
import type ScopeKey from '../../Scope/Key';
import type UriSchema from '../../DecorationProvider/UriSchema';


interface Element {
    type: ElementType.IntermediateNode;
    /** (*) Область, отображаемая этой веткой */
    scopeKey: ScopeKey;
    /** (*) Отображаемая метка */
    label: string;
    /** (*) Уникальный id узла в дереве */
    id: NodeId;
    children: ReadonlyArray<HierarchyElement>;
};


function create(
    id: NodeId,
    scopeKey: ScopeKey,
    label: string,
    children: ReadonlyArray<HierarchyElement>
): Readonly<Element> {
    return {
        type: ElementType.IntermediateNode,
        scopeKey,
        label,
        id,
        children
    } satisfies Element;
}


/**
 * Возвращает {@link vscode.TreeItem} для чистого промежуточного узла
 * (группы).
 * Intermediate-узел:
 * - всегда имеет не пустую иерархию детей
 * - никогда не сопоставлен задаче (с вытекающими)
 * */
function getTreeItem(
    element: Readonly<Element>,
    props: Readonly<{
        conf: Readonly<Conf["Node"]> | null,
    }>
): TreeItem {

    return {
        id: element.id,
        label: element.label,
        collapsibleState: TreeItemCollapsibleState.Collapsed, // @todo
        description: false,
        contextValue: `task-cockpit:Node:Group` satisfies ContextValue.Node.Intermediate,
        iconPath:
            props.conf?.useFolderIcon
                ? new ThemeIcon('symbol-folder') // 'folder' | @todo имя может отличатся для разных версий. проверь
                : undefined,
        resourceUri: Uri.from({
            scheme: 'task-cockpit',
            authority: 'Node',
            path: ''
        } satisfies UriSchema),
    } as const;
}


function resolveTreeItem(
    item: TreeItem,
    element: Readonly<Element>,
    token: Readonly<CancellationToken>
): Readonly<TreeItem> {

    if (token.isCancellationRequested) {
        return item;
    }

    item.tooltip = formatTooltip(
        'Group',
        element.label,
        undefined
    );

    return item;
}


const Element = {
    create,
    resolveTreeItem,
    getTreeItem
} as const;


export default Element;
