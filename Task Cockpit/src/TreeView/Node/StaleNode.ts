/** @file TreeView/Node/StaleNode.ts */
/** @module StaleNode */


import { ItemSeparator } from '../../constants';
import NodeType from '../NodeType';
import type PinsSection from '../Section/PinsSection';
import {
    MarkdownString,
    ThemeColor,
    ThemeIcon,
    TreeItemCollapsibleState,
    type CancellationToken,
    type ProviderResult,
    type TreeItem,
    Uri
} from 'vscode';


/** Узел-заглушка — отображается вместо прикреплённой задачи,
 * которая больше не существует. */
interface StaleNode {
    nodeKey: NodeType.StaleNodeKey;
    parent: Readonly<PinsSection>;
    label: string;
    scope: string;
}


const StaleNode = {

    /** Создаёт узел для потерянного пина.
     *
     * `label` + `scope` однозначно идентифицируют пин
     * независимо от того, существует задача или нет. */
    create(
        parent: Readonly<PinsSection>,
        label: string,
        scope: string
    ): Readonly<StaleNode> {
        return {
            nodeKey: NodeType.StaleNodeKey,
            parent,
            label,
            scope
        } as const;
    },

    /** Создаёт {@linkcode TreeItem} для узла потерянного пина.
     *
     * Иконка: `warning`
     * Состояние: лист
     * `contextValue`: `task-cockpit:Node:Special:Stale` */
    getTreeItem(node: Readonly<StaleNode>): TreeItem {

        const { parent, label, scope } = node;

        const contextType = 'Special:Stale';
        const id = `${parent.id}${ItemSeparator}\x00\x00${scope}${ItemSeparator}${label}`;

        const tooltip = new MarkdownString();
        tooltip.isTrusted = false;
        tooltip.supportHtml = false;
        tooltip.supportThemeIcons = false;
        tooltip.appendMarkdown(
            `*Pinned task no longer found in \`${scope}\`*` // @fixme displayName // @todo кнопки unpin|repin?
        );

        return {
            id,
            label,
            description: '(not found)', // @fixme наверное точнее будет "не совпадает"
            iconPath: new ThemeIcon('warning', new ThemeColor('list.warningForeground')),
            collapsibleState: TreeItemCollapsibleState.None,
            contextValue: `task-cockpit:Node:${contextType}`,
            resourceUri: Uri.from({
                scheme: 'task-cockpit',
                authority: 'Node',
                path: id,
                query: encodeURIComponent(JSON.stringify({ contextType }))
            }),
            tooltip
        };
    },

    resolveTreeItem(
        item: TreeItem,
        _node: Readonly<StaleNode>,
        _token: Readonly<CancellationToken>
    ): ProviderResult<TreeItem> {
        return item;
    },

    getChildren(_node: Readonly<StaleNode>): null {
        return null;
    },

    getParent(node: Readonly<StaleNode>): Readonly<PinsSection> {
        return node.parent;
    }

} as const;

export default StaleNode;
