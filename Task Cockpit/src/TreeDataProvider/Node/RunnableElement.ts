
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
import type Conf from '../../Configuration/Scoped/Config';
import type ContextValue from '../ContextValue';
import type Definition from '../../Scope/TaskSource/Definitions/Definition/Definition';
import type EligibleTask from '../../EligibleTask/EligibleTask';
import type HierarchyElement from '../../HierarchyModel/HierarchyElement';
import type NodeId from '../NodeId';
import type ScopeKey from '../../Scope/Key';
import type TaskName from '../../type.d/TaskName';
import type UriQuery from '../../DecorationProvider/UriQuery';
import type UriSchema from '../../DecorationProvider/UriSchema';


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
 *
 * Итоговый `TreeItem` определяется двумя независимыми свойствами узла:
 * наличием {@link definition} и наличием {@link children}.
 *
 * ---
 *
 * ### Сопоставлен с задачей (`definition !== null`)
 *
 * **`resourceUri`** — `task-cockpit://Node` (без path).
 * Query присутствует только если узел сопоставлен с задачей (`definition !== null`):
 * - `color` — `icon.color` задачи, если `nodeConfig.tintLabel` включён;
 * - `terminals=true` — если есть хотя бы один терминал (`processStats.total > 0`);
 * - `running=<n>` — количество работающих процессов (`processStats.running`).
 *
 * Если узел не сопоставлен с задачей (чистая группа) — query отсутствует.
 *
 * **`iconPath`** — `ThemeIcon` с `icon.id` из определения
 * (или `nodeConfig.defaultIconName` если отсутствует)
 * и `ThemeColor(icon.color)` (или `undefined`).
 *
 * **`description`** — активные флаги в формате `(Flag1, Flag2)`,
 * или `undefined`. Возможные значения: `Hidden`, `Default`, `Background`.
 *
 * ---
 *
 * ### Является ветвью (`children !== null`)
 *
 * **`iconPath`** — если узел *не* сопоставлен с задачей:
 * `ThemeIcon('symbol-folder')` при `nodeConfig.useFolderIcon`, иначе `undefined`.
 * (Если сопоставлен — иконка определяется задачей, см. выше.)
 *
 * **`tooltip`** — назначается резолвером (@todo)
 *
 * ---
 *
 * ### Общее (не зависит от комбинации)
 *
 * **`id`** -- node.id
 *
 * **`collapsibleState`** — `Collapsed` если `children !== null`, иначе `None`.
 *
 *
 * **`contextValue`** — строка вида `task-cockpit:Node:T1:T2:...:Tn`,
 * где токены добавляются независимо:
 * - `:Runnable` — `definition !== null`;
 * - `:Group` — `children !== null`;
 * - `:Running` — есть живые процессы;
 * - `:Terminals` — есть терминалы;
 * - `:Broken` — задача не распознана VS Code;
 * - `:Pinned` — задача запинована.
 *
 * @param
 * @param runtimeState Runtime-состояние расширения (процессы, пины и т.д.).
 *     */
function getTreeItem(
    element: Readonly<Element>,
    props: Readonly<{
        conf: Readonly<Conf['Node']> | null,
        definition: Readonly<Definition> | null;
        hasEligibleTask: boolean;
        isPinned: boolean,
        runtimeState: Readonly<RuntimeState> | null;
    }>
): TreeItem {

    const treeItem: TreeItem = {
        id: element.id,
        label: element.label,
        collapsibleState: buildCollapsibleState(element),
        description: buildDescription(props.definition),
        contextValue: buildContextValue(
            element,
            props.definition,
            props.hasEligibleTask,
            props.isPinned,
            props.runtimeState
        ),
        iconPath: buildIconPath(props.definition, props.conf),
        resourceUri: buildResourceURI(props),
    } as const;

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
            `$(warning) Stale pin — task definition not found`
        );
        return item;
    }

    if (!props.eligibleTask) {
        item.tooltip = formatTooltip(
            'Task',
            element.label,
            `$(warning) Unresolved — no task matches this definition`
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
    definition: Readonly<Definition> | null
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


/** Возвращает контекст узла — **`contextValue`**, строку вида `task-cockpit:Node:T1:T2:...:Tn`,
 * где токены добавляются независимо:
 * Статические
 * - `:Broken` — задача не распознана VS Code;
 * - `:Runnable` — `definition !== null`;
 * - `:Group` — `children !== null`;
 * Динамические
 * - `:Pinned` — задача запинована.
 * - `:Running` — есть живые процессы;
 * - `:Terminals` — есть терминалы (подразумевается что есть хотя бы один процесс);
 * */
function buildContextValue(
    element: Readonly<Element>,
    definition: Readonly<Definition> | null,
    hasEligibleTask: boolean,
    isPinned: boolean,
    runtimeState: Readonly<RuntimeState> | null
): ContextValue.Node.Runnable {

    return `task-cockpit${':Node'
        }${element.children == null ? '' : ':Group'
        }${hasEligibleTask
            ? ':Runnable:Broken'
            : `:Runnable${runtimeState == null
                ? ''
                : `${runtimeState.running === 0 ? '' : ':Running'}${runtimeState.total === 0 ? '' : ':Terminals'}` as const
            }` as const
        }${isPinned
            ? definition == null ? ':Pinned:Stale' : ':Pinned'
            : ''
        }` as const;

}


function buildIconPath(
    definition: Readonly<Definition> | null,
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
    props: Readonly<{
        conf: Readonly<Conf['Node']> | null,
        definition: Readonly<Definition> | null;
        runtimeState: Readonly<RuntimeState> | null;
        hasEligibleTask: boolean;
    }>
): Uri {

    return Uri.from({
        scheme: 'task-cockpit',
        authority: 'Node',
        path: '',
        query: (new URLSearchParams({
            available:
                props.runtimeState
                    ? props.runtimeState.total.toString()
                    : '0',
            running:
                props.runtimeState
                    ? props.runtimeState.running.toString()
                    : '0',
            color:
                (props.definition && props.hasEligibleTask)
                    ? (props.conf?.tintLabel && props.definition.icon?.color) || ''
                    : 'list.invalidItemForeground'
        } satisfies UriQuery)).toString()
    } satisfies UriSchema);

}

const Element = {
    create,
    resolveTreeItem,
    getTreeItem
} as const;


export default Element;
