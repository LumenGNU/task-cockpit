import {
    ThemeIcon,
    TreeItemCollapsibleState,
    type CancellationToken,
    type ProviderResult,
    type TreeItem,
    Uri
} from 'vscode';
import formatTooltip from '../formatTooltip';
import type Conf from './Conf';
import type ContextValue from '../ContextValue';
import type HierarchyElement from '../HierarchyElement';
import type NodeId from '../NodeId';
import NodeType from '../NodeType';
import type ScopeKey from '../../Scope/Key';
import type UriSchema from '../../DecorationProvider/UriSchema';


interface IntermediateNode {

    /** (*) Уникальный id узла в дереве */
    nodeId: NodeId;

    /** (*) Тип узла. */
    nodeType: NodeType.IntermediateNode;

    viewData: Readonly<{

        /** (*) Область, отображаемая этой веткой */
        scopeKey: ScopeKey;

        /** (*) Отображаемая метка */
        label: string;

        children: ReadonlyArray<HierarchyElement>;
    }>;
}


const IntermediateNode = {

    create(
        nodeId: NodeId,
        viewData: IntermediateNode['viewData']
    ): Readonly<IntermediateNode> {

        return {
            nodeId,
            nodeType: NodeType.IntermediateNode,
            viewData
        } as const;
    },


    /**
     * Возвращает {@link vscode.TreeItem} для чистого промежуточного узла
     * (группы).
     * Intermediate-узел:
     * - всегда имеет не пустую иерархию детей
     * - никогда не сопоставлен задаче (с вытекающими)
     * */
    getTreeItem(
        contentNode: Readonly<IntermediateNode>,
        props: Readonly<{
            conf: Readonly<Conf> | null, // null
        }>
    ): TreeItem {

        return {
            id: contentNode.nodeId,
            label: contentNode.viewData.label,
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
    },

    resolveTreeItem(
        item: TreeItem,
        intermediateNode: Readonly<IntermediateNode>,
        token: Readonly<CancellationToken>
    ): ProviderResult<TreeItem> {

        if (token.isCancellationRequested) {
            return item;
        }

        item.tooltip = formatTooltip(
            'Group',
            intermediateNode.viewData.label,
            undefined
        );

        return item;
    }

} as const;


export default IntermediateNode;
