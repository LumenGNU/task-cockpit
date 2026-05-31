import { ItemSeparator } from '../../constants';
import TreeModel from '../../TreeModel';
import NodeType from '../NodeType';
import WorkSpace from '../../ProjectSpace';
import type EligibleTask from '../../EligibleTask';
import type ScopeSection from '../Section/ScopeSection';
import type SubSection from '../Section/SubSection';
import {
    type TreeItem,
    TreeItemCollapsibleState,
    ThemeIcon,
    ThemeColor,
    Uri
} from 'vscode';
import assert from 'node:assert/strict';
import Runtime from '../../Runtime';
import type UriSchema from '../../type.d/UriSchema';
import type TaskId from '../../type.d/TaskId';
import type TaskName from '../../type.d/TaskName';
import type Key from '../../ProjectSpace/Scope/Key';


type Flags = number & { readonly ___Flags: unique symbol; };

declare namespace ContentNode {

    export type Parent =
        | ScopeSection
        // | SubSection
        | ContentNode
        ;
}

const enum Flag {
    None = 0,
    Background = 1 << 0,
    Default = 1 << 1,
    Hidden = 1 << 2
}

type HierarchyElement = Readonly<
    | TreeModel.Hierarchy.Data<{ readonly taskName: TaskName; }>
    | TreeModel.Hierarchy.Branch<{ readonly taskName: TaskName; }>
>;

type ContextPrefix = 'task-cockpit:Node';


// Работает. НО рекурсия и факториалы.
// type Permutations<T extends string, U extends string = T> =
//   [T] extends [never]
//     ? ''
//     : T extends any
//       ? '' | `:${T}${Permutations<Exclude<U, T>>}`
//       : never;
// Работает. НО требует стабильного порядка
type SubsetSuffixes<T extends string[]> =
    T extends [infer H extends string, ...infer Tail extends string[]]
    ? SubsetSuffixes<Tail> | `:${H}${SubsetSuffixes<Tail>}`
    : '';

type StaticContext = `${ContextPrefix}${SubsetSuffixes<[
    'Group',
    'Runnable',
    'Broken'
]>}`;

type ContextValue = `${StaticContext}${SubsetSuffixes<[
    'Running',
    'Terminals',
    'Pinned'
]>}`;


// type Token = TokenStatic & TokenDynamic;



/** Данные внешнего состояния, необходимые для построения TreeItem. */
interface ViewContext {

    /** задача из Индекса задач. */
    eligibleTask: Readonly<EligibleTask> | null;
    /** Runtime-состояние (процессы, терминалы). */
    processStats: Runtime.ProcessStats | null;
    /** Пользовательское состояние (пины, выделения, раскрытие). */
    userState: any; // @todo @fixme wip

}

interface ContentNode {

    /** Тип узла. */
    typeKey: NodeType.ContentNode;

    /** Родительский узел. Группа или Секция */
    parent: Readonly<ContentNode.Parent>;

    /** Уникальный id узла в дереве */
    id: string;

    /** Отображаемая метка */
    label: string;

    /** Область, отображаемая этой веткой */
    scopeKey: Key;

    hierarchy: ReadonlyArray<HierarchyElement> | null;

    flags: Flags;

    staticContext: StaticContext;

    taskId?: TaskId;
}


const ContentNode = {

    // id формируется конкат. parent.id + label через разделитель
    create(
        parent: Readonly<ContentNode.Parent>,
        {
            hierarchy,
            eligibleIndex
        }: {
            hierarchy: Readonly<HierarchyElement>,
            eligibleIndex: Readonly<EligibleTask.Index> | null | undefined;
        }): Readonly<ContentNode> {

        const label = TreeModel.Hierarchy.getSegment(hierarchy);

        const nodeData = TreeModel.Hierarchy.isData(hierarchy) ? hierarchy : null;
        const children = TreeModel.Hierarchy.isBranch(hierarchy) ? TreeModel.Hierarchy.getBranchChildren(hierarchy) : null;

        nodeData?.taskName;
        const taskExists = eligibleIndex ? Boolean(eligibleIndex[nodeData.id]) : false;

        return {
            id: `${parent.id}${ItemSeparator}${label}`,
            typeKey: NodeType.ContentNode,
            label,
            hierarchy: children,
            parent,
            scopeKey: parent.scopeKey,
            flags: setFlags(nodeData),
            staticContext: buildStaticContext(children, nodeData, taskExists)
        } as const;

    },


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
     * - `broken=true` — если задача не распознана VS Code (`task === null`);
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
     * @param taskIndex Индекс задач.
     * @param runtimeState Runtime-состояние расширения (процессы, пины и т.д.).
     *     */
    getTreeItem(
        contentNode: Readonly<ContentNode>,
    ): TreeItem {



        const treeItem: TreeItem = {
            id: contentNode.id,
            label: contentNode.label,
            collapsibleState: buildCollapsibleState(contentNode),
            description: buildDescription(contentNode.flags),
            contextValue: buildContextValue(contentNode, viewContext),
            iconPath: buildIconPath(contentNode),
            resourceUri: buildResourceURI(contentNode, viewContext),
            // tooltip // @todo
        } as const;

        return treeItem;
    }

} as const;


function buildCollapsibleState(contentNode: Readonly<ContentNode>) {
    return hasChild(contentNode) ? TreeItemCollapsibleState.Collapsed/* @todo */ : TreeItemCollapsibleState.None;
}


function buildStaticContext(
    children: Readonly<TreeModel.Hierarchy.Branch<WorkSpace.Definition> | TreeModel.Hierarchy.Data<WorkSpace.Definition>>[] | null,
    definition: TreeModel.Hierarchy.Data<WorkSpace.Definition> | null,
    eligibleTask: Readonly<EligibleTask> | null
): StaticContext {
    // Runnable может быть Broken. viewContext нет для чистой группы. чистой группе точно не сопоставлена задача
    return `task-cockpit${':Node'
        }${(children != null) ? ':Group' : ''
        }${(definition != null) ? (eligibleTask == null ? ':Runnable:Broken' : ':Runnable') : ''
        }`;
}


function setFlags(definition: Readonly<WorkSpace.Definition> | null): Flags {

    let flags = Flag.None;

    if (!definition) {
        return flags as Flags;
    }

    if (definition.isBackground) {
        flags |= Flag.Background;
    }

    if (definition.hidden) {
        flags |= Flag.Hidden;
    }

    if (definition.group?.isDefault) {
        flags |= Flag.Default;
    }

    return flags as Flags;
}


// Формирует description-строку "(T1, T2, ..., Tn)" -
// Где теги описывают саму "задачу" . свойства не состояние:
// - Default — если у задачи поднят флаг "по умолчанию в своей группе"
// - Background — если у задачи поднят флаг "isBackground"
// - Hidden — если у задачи поднят флаг "hide" (увидят только если отключена фильтрация скрытых)
//
// По поводу Broken -- это скорее состояния самого узла "я показываю черти-что, а НЕ задачу".
// А состояние задачи "такой задачи нет" выглядит слегка неправильно.
//
// Порядок тегов стабильный
//
function buildDescription(flags: Flags): string | false {

    if (flags === Flag.None) {
        return false;
    }

    const strFlags: string[] = [];

    if (flags & Flag.Default) {
        strFlags.push('Default');
    }

    if (flags & Flag.Background) {
        strFlags.push('Background');
    }

    if (flags & Flag.Hidden) {
        strFlags.push('Hidden');
    }

    assert.ok(strFlags.length > 0, `Unrecognized flags: ${flags}`);

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
    staticContext: StaticContext,
    viewContext: Readonly<{
        processStats: Readonly<ProcessStats> | null;
        userState: any;
    } | null>
): ContextValue {

    const prefix = 'task-cockpit:Node:';

    const tokens: Token[] = [];

    if (isRunnable(contentNode)) {

        const taskId = contentNode.definition.id;
        const { task, processStats, userState } = viewContext;

        tokens.push('Runnable');

        if (!task) {
            tokens.push('Broken');
        }

        if (userState.pins.has(taskId)) {
            tokens.push('Pinned');
        }

        if (processStats) {
            tokens.push('Terminals');

            if (processStats.running > 0) {
                tokens.push('Running');
            }
        }
    }

    if (hasChild(contentNode)) {
        tokens.push('Group');
    }

    assert.ok(tokens.length > 0, 'ContentNode must be either Runnable or Group');

    return prefix + tokens.join(':');
}


function isRunnable(contentNode: Readonly<ContentNode>): contentNode is Readonly<ContentNode & { readonly definition: NonNullable<ContentNode['definition']>; }> {
    return contentNode.definition != null;
}


function hasChild(contentNode: Readonly<ContentNode>): contentNode is Readonly<ContentNode & { readonly children: NonNullable<ContentNode['children']>; }> {
    return contentNode.children != null;
}


function buildIconPath(contentNode: Readonly<ContentNode>): ThemeIcon | undefined {

    if (isRunnable(contentNode)) {

        const iconId = contentNode.definition.icon?.id ?? contentNode.nodeConfig.defaultIconName;
        const colorId = contentNode.definition.icon?.color;
        return new ThemeIcon(iconId, colorId ? new ThemeColor(colorId) : undefined);
    }

    assert.ok(hasChild(contentNode));

    if (contentNode.nodeConfig.useFolderIcon) {
        return new ThemeIcon('symbol-folder'); // @todo имя может отличатся для разных версий. проверь
    }

    return undefined;
}


function buildResourceURI(
    contentNode: Readonly<ContentNode>,
    viewContext: Readonly<ViewContext>
): Uri {

    const uriSchema: UriSchema = {
        scheme: 'task-cockpit',
        authority: 'Node',
    };

    if (isRunnable(contentNode)) {
        const { task, processStats } = viewContext;

        const usp = new URLSearchParams();

        if (contentNode.nodeConfig.tintLabel && contentNode.definition.icon?.color) {
            usp.set('color', contentNode.definition.icon.color);
        }

        if (task == null) { // @todo не ставить флаг, а сразу переопределять цвет
            usp.set('broken', 'true');
        }

        if (processStats) {

            if (processStats.total > 0) {
                usp.set('terminals', 'true');
            }

            usp.set('running', processStats.running.toString());

        }

        if (usp.size > 0) {
            uriSchema.query = usp.toString();
        }
    }

    return Uri.from(uriSchema);
}

export default ContentNode;
