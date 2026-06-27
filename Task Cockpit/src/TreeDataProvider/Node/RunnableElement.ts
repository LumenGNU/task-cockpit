
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
import type Conf from '../../Configuration/Resource/Config';
import type ContextValue from '../ContextValue';
import type TaskDefinition from '../../Configuration/TaskDefinition';
import type EligibleTask from '../../EligibleTask/EligibleTask';
import type HierarchyElement from '../../HierarchyModel/HierarchyElement';
import type NodeId from '../NodeId';
import type ScopeKey from '../../Scope/Key';
import type TaskName from '../../TaskName/TaskName';
import type UriQuery from '../../DecorationProvider/UriQuery';
import type UriSchema from '../../DecorationProvider/UriSchema';
import assert from 'node:assert/strict';
import Icon from '../../Configuration/Icon';


interface Element {
    type: ElementType.RunnableNode;
    /** (*) Область, отображаемая этой веткой */
    scopeKey: ScopeKey;
    taskName: TaskName;
    /** (*) Отображаемая метка */
    label: string;
    /** (*) Уникальный id узла в дереве */
    id: NodeId;
    children: ReadonlyArray<HierarchyElement> | null;
};


interface RuntimeState {

    /** Общее количество процессов у задачи */
    total: number;

    /** Процессы задачи в состоянии выполнения */
    running: number;
}


function create(
    id: NodeId,
    scopeKey: ScopeKey,
    label: string,
    children: ReadonlyArray<HierarchyElement> | null,
    taskName: TaskName,
): Readonly<Element> {
    return {
        type: ElementType.RunnableNode,
        /** (*) Область, отображаемая этой веткой */
        scopeKey,
        taskName,
        /** (*) Отображаемая метка */
        label,
        /** (*) Уникальный id узла в дереве */
        id,
        children
    } satisfies Element;
}


/** Создаёт {@link vscode.TreeItem} для узла содержимого.
 *     */
function createTreeItem(
    element: Readonly<Element>,
    props: Readonly<{
        conf: Readonly<Conf['Node']>,
        taskDefinition: Readonly<TaskDefinition> | null;
        hasEligibleTask: boolean;
    }>
): TreeItem {

    // Цвет окраски label:
    // 'list.invalidItemForeground' — если taskDefinition=null или
    // hasEligibleTask=false.
    // Иначе, если conf.tintLabel=true, то из taskDefinition.icon?.color ?? ''.
    // Пустая строка — в остальных случаях.
    const tintColor = props.taskDefinition === null || !props.hasEligibleTask
        ? 'list.invalidItemForeground'
        : props.conf.tintLabel
            ? props.taskDefinition.icon?.color ?? ''
            : '';

    const treeItem: TreeItem = {
        id: element.id,
        label: element.label,
        collapsibleState: buildCollapsibleState(element),
        description: buildDescription(props.taskDefinition),
        // статическая часть contextValue
        contextValue: buildContextValue(element.children != null, props.taskDefinition != null),
        iconPath: buildIconPath(props.taskDefinition, props.conf),
        // статическая часть resourceUri (только query color, если есть)
        resourceUri: buildResourceURI(tintColor)
    } as const;

    return treeItem;
}


function applyRuntimeState(treeItem: TreeItem, runtimeState: Readonly<RuntimeState> | null): TreeItem {
    updateResourceUriQuery(treeItem, runtimeState);
    updateContextValue(treeItem, runtimeState);
    return treeItem;
}


function resolveTreeItem(
    item: TreeItem,
    element: Readonly<Element>,
    props: Readonly<{
        hasDefinition: boolean,
        eligibleTask: Readonly<EligibleTask> | null;
    }>,
    token: Readonly<CancellationToken>
): Readonly<TreeItem> {

    if (token.isCancellationRequested) {
        return item;
    }

    if (!props.hasDefinition) {
        item.tooltip = formatTooltip(
            'Task',
            element.label,
            `$(warning) Task definition not found`
        );
        return item;
    }

    if (!props.eligibleTask) {
        item.tooltip = formatTooltip(
            'Task',
            element.label,
            `$(warning) No task matches this definition`
        );
        return item;
    }

    item.tooltip = formatTooltip(
        'Task',
        element.label,
        props.eligibleTask.detail
    );

    return item;
}


// @todo from UserState
function buildCollapsibleState(element: Readonly<Element>) {
    return element.children == null ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed/* @todo */;
}



/** Формирует description-строку "(T1, T2, ..., Tn)" -
 * Где теги описывают саму "задачу" . свойства не состояние:
 * - Default — если у задачи поднят флаг "по умолчанию в своей группе"
 * - Background — если у задачи поднят флаг "isBackground"
 * - Hidden — если у задачи поднят флаг "hide" (увидят только если отключена фильтрация скрытых)
 *
 * По поводу Broken -- это скорее состояния самого узла "я показываю черти-что, а НЕ задачу".
 * А состояние задачи "такой задачи нет" выглядит слегка неправильно.
 *
 * Порядок тегов стабильный.
 * Description есть только у runnable-узлов сопоставленного задаче.
 * */
function buildDescription(
    definition: Readonly<TaskDefinition> | null
): string | false {

    if (!definition) {
        return false;
    }

    const strFlags: string[] = [];

    if (definition.group?.isDefault) {
        strFlags.push('Default');
    }

    if (definition.isBackground) {
        strFlags.push('Background');
    }

    if (definition.hidden) {
        strFlags.push('Hidden');
    }

    if (strFlags.length < 1) {
        return false;
    }

    return `(${strFlags.join(', ')})`;
}


// статическая часть contextValue
function buildContextValue(
    hasChildren: boolean,
    hasEligibleTask: boolean
): ContextValue.Node.Runnable {

    return `task-cockpit${':Node'
        }${hasChildren
            ? ':Group'
            : ''
        }${hasEligibleTask
            ? ':Runnable'
            : ':Runnable:Broken'
        }`;
}


function updateContextValue(
    treeItem: TreeItem,
    runtimeState: Readonly<RuntimeState> | null
) {

    // изменяет contextValue на основе runtimeState.
    // Добавляет / удаляет флаги
    // `:Running` — если runtimeState.running (> / ==) 0
    // `:Terminals` — если runtimeState.total (> / ==) 0

    assert.ok(treeItem.contextValue, '??????????????????');

    // Удалить старые флаги, если они есть
    let contextValue = treeItem.contextValue!.replace(/:Running\b/, '').replace(/:Terminals\b/, '');

    // ставим флаги
    if (runtimeState && runtimeState.running > 0) {
        contextValue += ':Running';
    }
    if (runtimeState && runtimeState.total > 0) {
        contextValue += ':Terminals';
    }

    treeItem.contextValue = contextValue;

}


function buildIconPath(
    definition: Readonly<TaskDefinition> | null,
    conf: Readonly<Conf['Node']> | null,
): ThemeIcon {

    if (!definition) {
        return new ThemeIcon('circle-slash', new ThemeColor('list.invalidItemForeground'));
    }

    const iconId = definition.icon?.id ?? conf?.defaultIconName ?? 'tools';
    const colorId = definition.icon?.color;
    return new ThemeIcon(iconId, colorId ? new ThemeColor(colorId) : undefined);
}


function buildResourceURI(
    tintColor: string
): Uri {
    return Uri.from({
        scheme: 'task-cockpit',
        authority: 'Node',
        path: '',
        query: (new URLSearchParams({
            available: '0',
            running: '0',
            tintColor
        } satisfies UriQuery)).toString()
    } satisfies UriSchema);
}


function updateResourceUriQuery(
    treeItem: TreeItem,
    runtimeState: Readonly<RuntimeState> | null
) {

    const resourceUri = treeItem.resourceUri;
    assert.ok(resourceUri);

    const params = new URLSearchParams(resourceUri.query);
    params.set('available', runtimeState?.total.toString() ?? '0');
    params.set('running', runtimeState?.running.toString() ?? '0');

    treeItem.resourceUri = resourceUri.with({ query: params.toString() });

}

const Element = {
    create,
    resolveTreeItem,
    createTreeItem,
    applyRuntimeState
} as const;


export default Element;;;
