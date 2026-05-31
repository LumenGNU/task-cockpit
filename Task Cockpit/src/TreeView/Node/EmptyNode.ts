/** @file TreeView/Node/EmptyNode.ts */
/** @module EmptyNode */


import { ItemSeparator } from '../../constants';
import UriSchema from '../../type.d/UriSchema';
import NodeType from '../NodeType';
import type ScopeSection from '../Section/ScopeSection';
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


/** Узел-заглушка — отображается внутри секции,
 * когда секция пуста. */
interface EmptyNode {
    typeKey: NodeType.EmptyNode;
    parent: Readonly<ScopeSection>;
}


const EmptyNode = {

    /** Создаёт узел-заглушку для пустой секции. */
    create(parent: Readonly<ScopeSection>): Readonly<EmptyNode> {

        return {
            typeKey: NodeType.EmptyNode,
            parent
        } as const;
    },


    /** Создаёт {@linkcode TreeItem} для узла-заглушки.
     *
     * Иконка: `-`
     * Состояние: лист
     * `contextValue`: `task-cockpit:Node:Special:(Empty|Hidden)` */
    getTreeItem(emptyNode: Readonly<EmptyNode>): TreeItem {

        const parent = emptyNode.parent;

        const total = parent.stats.total;

        const allHidden = total > 0
            && parent.stats.excluded === total;

        const contextType = `Special:${allHidden ? 'Hidden' : 'Empty'}`;

        // Стабильный поскольку может быть только эксклюзивно один на секцию
        const id = `${parent.id}${ItemSeparator}\x00\x00${contextType}`;

        const tooltip = new MarkdownString();
        tooltip.isTrusted = false;
        tooltip.supportHtml = false;
        tooltip.supportThemeIcons = false;

        const kind =
            parent.isWorkspace
                ? 'workspace'
                : 'folder';

        if (allHidden) {
            tooltip.appendMarkdown(
                `*All \`${total}\` task${total === 1 ? '' : 's'} hidden by active filters*  \n` +
                '\u00A0'
            );
        } else {
            tooltip.appendMarkdown(
                `*No tasks in this ${kind}*  \n` +
                '\u00A0'
            );
        }

        return {
            id,
            label: 'No tasks',
            description: allHidden ? '(all filtered out)' : `(empty ${kind})`,
            iconPath: new ThemeIcon('dash', new ThemeColor('list.deemphasizedForeground')),
            collapsibleState: TreeItemCollapsibleState.None,
            contextValue: `task-cockpit:Node:${contextType}`,
            resourceUri: buildResourceURI(),
            tooltip
        };
    },


    resolveTreeItem(
        item: TreeItem,
        _emptyNode: Readonly<EmptyNode>,
        _token: Readonly<CancellationToken>
    ): ProviderResult<TreeItem> {
        return item;
    },

} as const;


function buildResourceURI(): Uri {

    const usp = new URLSearchParams();

    usp.set('color', 'list.deemphasizedForeground');

    const uriSchema: UriSchema = {
        scheme: 'task-cockpit',
        authority: 'Node',
        query: usp.toString()
    };

    return Uri.from(uriSchema);
}


export default EmptyNode;
