import {
    ThemeIcon,
    TreeItemCollapsibleState,
    type CancellationToken,
    type TreeItem,
    Uri
} from 'vscode';
import formatTooltip from '../formatTooltip';
import type Conf from '../../../ResourceState/ResourceConfig/Config';
import type ContextValue from '../ContextValue';
import type UriSchema from '../../../DecorationProvider/UriSchema';
import HierarchyModel from '../../../HierarchyModel/HierarchyModel';
import TaskName from '../../../TaskName';
import RunnableElement from './RunnableElement';
import { Scope } from '../../../ResourceState/ResourceStateCoordinator';
import ScopeKey from '../../../ScopeKey';
import type Immutable from '../../../utils/Immutable';


type NodeConfiguration = Conf["Node"];

type IntermediateElement = Omit<HierarchyModel.Element<ScopeKey, { taskName: TaskName; }>, 'data' | 'children'> & { data: null; children: Array<IntermediateElement | RunnableElement>; };

/**
 * Возвращает {@link vscode.TreeItem} для чистого промежуточного узла
 * (группы).
 * Intermediate-узел:
 * - всегда имеет не пустую иерархию детей
 * - никогда не сопоставлен задаче (с вытекающими)
 * */
function createTreeItem(
    element: Immutable<IntermediateElement>,
    props: Immutable<{
        conf: NodeConfiguration | null,
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
