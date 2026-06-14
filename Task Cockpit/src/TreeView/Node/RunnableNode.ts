
import {
    ThemeColor,
    ThemeIcon,
    TreeItemCollapsibleState,
    type CancellationToken,
    type ProviderResult,
    type TreeItem,
    Uri,
} from 'vscode';
import formatTooltip from '../formatTooltip';
import NodeType from '../NodeType';
import type Conf from './Conf';
import type ContextValue from '../ContextValue';
import type Definition from '../../Scope/TaskSource/Definitions/Definition/Definition';
import type EligibleTask from '../../EligibleTask/EligibleTask';
import type HierarchyElement from '../HierarchyElement';
import type NodeId from '../NodeId';
import type ScopeKey from '../../Scope/Key';
import type TaskName from '../../type.d/TaskName';
import type UriQuery from '../../DecorationProvider/UriQuery';
import type UriSchema from '../../DecorationProvider/UriSchema';


interface RunnableNode {

    /** (*) Уникальный id узла в дереве */
    nodeId: NodeId;

    /** (*) Тип узла. */
    nodeType: NodeType.RunnableNode;

    viewData: Readonly<{

        /** (*) Область, отображаемая этой веткой */
        scopeKey: ScopeKey;

        children: ReadonlyArray<HierarchyElement> | null;

        /** (*) Отображаемая метка */
        label: string;

        taskName: TaskName;
    }>;
}


interface RuntimeState {

    /** Общее количество процессов у задачи */
    total: number;

    /** Процессы задачи в состоянии выполнения */
    running: number;
}


const RunnableNode = {

    create(
        nodeId: NodeId,
        viewData: Readonly<RunnableNode['viewData']>
    ): Readonly<RunnableNode> {

        return {
            nodeId,
            nodeType: NodeType.RunnableNode,
            viewData
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
    getTreeItem(
        contentNode: Readonly<RunnableNode>,
        props: Readonly<{
            conf: Readonly<Conf> | null,
            definition: Readonly<Definition> | null;
            eligibleTask: Readonly<EligibleTask> | null;
            runtimeState: Readonly<RuntimeState> | null;
        }>
    ): TreeItem {

        const treeItem: TreeItem = {
            id: contentNode.nodeId,
            label: contentNode.viewData.label,
            collapsibleState: buildCollapsibleState(contentNode.viewData),
            description: buildDescription(props.definition),
            contextValue: buildContextValue(contentNode.viewData, props.definition, props.eligibleTask, props.runtimeState),
            iconPath: buildIconPath(props.definition, props.conf),
            resourceUri: buildResourceURI(props),
        } as const;

        return treeItem;
    },


    resolveTreeItem(
        item: TreeItem,
        runnableNode: Readonly<RunnableNode>,
        props: Readonly<{
            definition: Readonly<Definition> | null,
            eligibleTask: Readonly<EligibleTask> | null;
        }>,
        token: Readonly<CancellationToken>
    ): ProviderResult<TreeItem> {

        if (token.isCancellationRequested) {
            return item;
        }

        if (!props.definition) {
            item.tooltip = formatTooltip(
                'Task',
                runnableNode.viewData.label,
                `$(warning) Stale pin — task definition not found`
            );
            return item;
        }

        if (!props.eligibleTask) {
            item.tooltip = formatTooltip(
                'Task',
                runnableNode.viewData.label,
                `$(warning) Unresolved — no task matches this definition`
            );
            return item;
        }

        item.tooltip = formatTooltip(
            'Task',
            runnableNode.viewData.label,
            props.eligibleTask.detail
        );

        return item;
    }

} as const;


// @todo from UserState
function buildCollapsibleState(viewData: Readonly<RunnableNode['viewData']>) {
    return viewData.children == null ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed/* @todo */;
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
    viewData: Readonly<RunnableNode['viewData']>,
    definition: Readonly<Definition> | null,
    eligibleTask: Readonly<EligibleTask> | null,
    runtimeState: Readonly<RuntimeState> | null
): ContextValue.Node.Runnable {

    return `task-cockpit${':Node'
        }${viewData.children == null ? '' : ':Group'
        }${eligibleTask == null
            ? ':Runnable:Broken'
            : `:Runnable${runtimeState == null
                ? ''
                : `${runtimeState.running === 0 ? '' : ':Running'}${runtimeState.total === 0 ? '' : ':Terminals'}` as const
            }` as const
        }` as const; // @todo ':Pinned'

}


function buildIconPath(
    definition: Readonly<Definition> | null,
    nodeConfig: Readonly<Conf> | null,
): ThemeIcon {

    if (!definition) {
        return new ThemeIcon('circle-slash', new ThemeColor('list.invalidItemForeground'));
    }

    const iconId = definition.icon?.id ?? nodeConfig?.defaultIconName ?? 'tools';
    const colorId = definition.icon?.color;
    return new ThemeIcon(iconId, colorId ? new ThemeColor(colorId) : undefined);
}


function buildResourceURI(
    props: Readonly<{
        conf: Readonly<Conf> | null,
        definition: Readonly<Definition> | null;
        runtimeState: RuntimeState | null;
        eligibleTask: Readonly<EligibleTask> | null;
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
                (props.definition && props.eligibleTask)
                    ? (props.conf?.tintLabel && props.definition.icon?.color) || ''
                    : 'list.invalidItemForeground'
        } satisfies UriQuery)).toString()
    } satisfies UriSchema);

}

export default RunnableNode;
