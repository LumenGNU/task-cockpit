
import {
    ThemeColor,
    ThemeIcon,
    TreeItemCollapsibleState,
    type CancellationToken,
    type ProviderResult,
    type TreeItem,
    Uri
} from 'vscode';
import formatTooltip from '../formatTooltip';
import NodeType from '../NodeType';
import type ContextValue from '../ContextValue';
import type NodeId from '../NodeId';
import type ScopeKey from '../../Scope/Key';
import type ScopeType from '../../Scope/Type';
import type UriSchema from '../../DecorationProvider/UriSchema';


/** Узел-заглушка — отображается внутри секции,
 * когда секция пуста. */
interface EmptyNode {

    /** (*) Уникальный id узла в дереве */
    nodeId: NodeId;

    /** (*) Тип узла. */
    nodeType: NodeType.EmptyNode;

    viewData: Readonly<{

        /** (*) Область, отображаемая этой веткой */
        scopeKey: ScopeKey;

        /** (*) Отображаемая метка */
        label: string;

        cause: 'Hidden' | 'Empty';

        /** Логический тип области */
        scopeType: ScopeType; // @todo полее подробное описание "почему-где" ?
    }>;
}


const EmptyNode = {

    /** Создаёт узел-заглушку для пустой секции. */
    create(
        nodeId: NodeId,
        viewData: EmptyNode['viewData']
    ): Readonly<EmptyNode> {

        return {
            nodeId,
            nodeType: NodeType.EmptyNode,
            viewData
        } as const;
    },


    /** Создаёт {@linkcode TreeItem} для узла-заглушки.
     *
     * Иконка: `-`
     * Состояние: лист
     * `contextValue`: `task-cockpit:Node:Special:(Empty|Hidden)` */
    getTreeItem(emptyNode: Readonly<EmptyNode>): TreeItem {

        return {
            id: emptyNode.nodeId,
            label: emptyNode.viewData.label,
            description: false,
            iconPath: new ThemeIcon('dash', new ThemeColor('list.deemphasizedForeground')),
            collapsibleState: TreeItemCollapsibleState.None,
            contextValue: `task-cockpit:Node:Special:${emptyNode.viewData.cause}` satisfies ContextValue.Node.Special,
            resourceUri: buildResourceURI()
        };
    },


    resolveTreeItem(
        item: TreeItem,
        emptyNode: Readonly<EmptyNode>,
        token: Readonly<CancellationToken>
    ): ProviderResult<TreeItem> {

        if (token.isCancellationRequested) {
            return item;
        }

        item.tooltip = formatTooltip(
            undefined,
            undefined,
            (emptyNode.viewData.cause === 'Hidden')
                ? '*All tasks hidden by active filters*'
                : '*No tasks in this scope*'
        );

        return item;
    },

} as const;


function buildResourceURI(): Uri {

    return Uri.from({
        scheme: 'task-cockpit',
        authority: 'Node',
        path: '',
        query: (new URLSearchParams({
            color: 'list.deemphasizedForeground'
        })).toString()
    } satisfies UriSchema);
}


export default EmptyNode;
