/** @file TreeViewPanel/TreeView/Element/IntermediateElement.ts */

import {
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
import type HierarchyModel from '../../../HierarchyModel/HierarchyModel';
import type Immutable from '../../../utils/Immutable';
import type OriginKey from '../../../OriginKey';
import type RunnableElement from './RunnableElement';
import type TaskName from '../../../TaskName';
import type UriSchema from '../../../FileDecorationProvider/UriSchema';
import type ResourceConfig from '../../../ResourceStateCoordinator/ResourceConfig/ResourceConfig';


type IntermediateElement = Omit<HierarchyModel.Element<OriginKey, { taskName: TaskName; }>, 'data' | 'children'> & { data: null; children: Array<IntermediateElement | RunnableElement>; };

/**
 * Возвращает {@link TreeItem} для чистого промежуточного узла
 * (группы).
 * Intermediate-узел:
 * - всегда имеет не пустую иерархию детей
 * - никогда не сопоставлен задаче (с вытекающими)
 * */
function createTreeItem(
    element: Immutable<IntermediateElement>,
    resourceConfig: Immutable<ResourceConfig> | null
): TreeItem {

    return {
        id: element.id,
        label: element.label,
        collapsibleState: TreeItemCollapsibleState.Collapsed, // @todo
        description: false,
        contextValue: ':Node:Group' satisfies ContextValue.Node.Intermediate,
        iconPath:
            resourceConfig?.Node.useFolderIcon
                ? new ThemeIcon(UI.ICON.SYMBOL_FOLDER)
                : undefined,
        resourceUri: Uri.from({
            scheme: 'task-cockpit',
            authority: 'Node',
            path: ''
        } satisfies UriSchema)
    } as const;
}


function resolveTreeItem(
    item: TreeItem,
    element: Immutable<IntermediateElement>,
    token: CancellationToken
): TreeItem {

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


const IntermediateElement = {
    resolveTreeItem,
    createTreeItem
} as const;


export default IntermediateElement;
