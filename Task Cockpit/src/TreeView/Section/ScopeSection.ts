/** @file TreeView/Section/ScopeSection.ts */
/** @module ScopeSection */


import NodeType from '../NodeType';
import TreeModel from '../../TreeModel';
import WorkSpace from '../../ProjectSpace';
import {
    MarkdownString,
    ThemeIcon,
    TreeItem,
    TreeItemCollapsibleState,
    type CancellationToken,
    type ProviderResult,
    type Uri
} from 'vscode';
import Key from '../../ProjectSpace/Scope/Key';
import NodeSpec from '../../TreeModel/NodeSpec';
import TaskName from '../../type.d/TaskName';


type HierarchyElement = Readonly<
    | TreeModel.Hierarchy.Data<{ readonly taskName: TaskName; }>
    | TreeModel.Hierarchy.Branch<{ readonly taskName: TaskName; }>
>;


/** `ScopeSection` — ViewModel корневого узла дерева задач для одного scope'а
 * (workspace или папка).
 *
 * Строится из {@linkcode WorkSpace.Snapshot.ScopeInput} фабрикой {@linkcode ScopeSection.build}
 * и содержит всё необходимое для рендеринга узла и его дочерней иерархии
 * через `TreeDataProvider`. */
interface ScopeSection {

    /** Тип узла. */
    typeKey: NodeType.ScopeSection;


    displayName: string;

    resourceUri: Uri;

    isWorkspace: boolean;

    /** Элементы модели дерева — результат построения иерархии для данной области.
     * Всегда массив, возможно пустой */
    hierarchy: ReadonlyArray<HierarchyElement>;


    /** Статистика задач, попавших в это дерево. */
    stats: Readonly<{
        total: number;
        excluded: number;
    }>;

    id: string;
    scopeKey: Key;
}


const ScopeSection = {


    /** Создает секцию для одной области рабочего пространства.
     *
     * Определения задач с флагом `hidden = true` исключаются, если только `hierarchyConfig.showHidden`
     * не выставлен.
     *
     * Компрессия путей в иерархии всегда отключена.
     *
     * @returns Построенная секция */
    create({
        scopeKey,
        scopeInput
    }: {
        /** Область которую отображает ветка */
        scopeKey: Key;
        /** Входные данные из снапшота, описывающие эту область */
        scopeInput: Readonly<WorkSpace.Snapshot.ScopeInput>;
    }): Readonly<ScopeSection> {

        const { hierarchy, stats } = buildHierarchy(scopeInput.definitions, scopeInput.config.hierarchyConfig);

        return {
            id: scopeKey,
            scopeKey,
            typeKey: NodeType.ScopeSection,
            displayName: WorkSpace.Scope.displayName(scopeInput.scope),
            resourceUri: WorkSpace.Scope.getSourceUri(scopeInput.scope),
            isWorkspace: WorkSpace.Scope.isWorkspace(scopeInput.scope),
            hierarchy,
            stats
        } as const;
    },


    /** Создаёт {@linkcode TreeItem} для корневого узла области рабочего пространства.
     *
     * Иконка:
     * - `layers` — рабочее пространство
     * - `root-folder` — папка
     *
     * Состояние: всегда развёрнут // @todo
     *
     * `resourceUri` — файл-источник задач (не обязан существовать)
     *
     * `contextValue`: `task-cockpit:Section:Scope:(Workspace|Folder)` */
    getTreeItem(section: Readonly<ScopeSection>): TreeItem {

        return {
            id: section.id,
            label: section.displayName,
            collapsibleState: TreeItemCollapsibleState.Expanded, // @todo
            resourceUri: section.resourceUri,
            ...(
                section.isWorkspace
                    ? {
                        iconPath: new ThemeIcon('layers'),
                        contextValue: 'task-cockpit:Section:Scope:Workspace'
                    }
                    : {
                        iconPath: new ThemeIcon('root-folder'),
                        contextValue: 'task-cockpit:Section:Scope:Folder'
                    }
            ),
            description: false
        } as const;
    },


    /** Дополняет элемент-секцию всплывающей подсказкой.
     *
     * Вызывается средой лениво.
     *
     * Если операция отменена, возвращает элемент без изменений. */
    resolveTreeItem(
        item: TreeItem,
        section: Readonly<ScopeSection>,
        token: Readonly<CancellationToken>
    ): ProviderResult<TreeItem> {

        if (token.isCancellationRequested) {
            return item;
        }

        const tooltip = new MarkdownString();
        tooltip.isTrusted = false;
        tooltip.supportHtml = false;
        tooltip.supportThemeIcons = true;

        tooltip.appendMarkdown(
            `**${section.displayName || '<unnamed>'}**${section.isWorkspace ? '' : ' (*folder*)'}  \n` +
            `$(tools) Tasks: ${formatTasksSummary(section.stats)}  \n` +
            '\u00A0'
        );

        item.tooltip = tooltip;
        return item;
    },


} as const;


function buildHierarchy(
    definitionMap: WorkSpace.Definition.DefinitionMap,
    hierarchyConfig: Readonly<WorkSpace.ScopedConfig['hierarchyConfig']>
): Readonly<{
    hierarchy: ReadonlyArray<
        Readonly<
            | TreeModel.Hierarchy.Data<{ readonly taskName: TaskName; }>
            | TreeModel.Hierarchy.Branch<{ readonly taskName: TaskName; }>
        >
    >;
    stats: Readonly<{
        total: number;
        excluded: number;
    }>;
}> {

    const nodeDataItems = WorkSpace.Definition.extractTaskNames(
        definitionMap,
        hierarchyConfig.showHidden ? undefined : function (_name, definition) { return !definition.hidden; }
    )
        .map(function (taskName) { return [taskName, { taskName }] as const; });

    return {
        hierarchy: TreeModel.Hierarchy.buildRoots<{ readonly taskName: TaskName; }>(
            NodeSpec.createSpecs({
                nodeDataItems,
                hierarchyConfig,
                compression: 'off'
            })
        ),
        stats: {
            total: definitionMap.size,
            excluded: definitionMap.size - nodeDataItems.length
        } as const
    } as const;


}


/** Форматирует краткую сводку по видимости задач
 * для отображения во всплывающей подсказке.
 *
 * Обрабатываются четыре ситуации:
 * - В области нет задач
 * - Все задачи скрыты
 * - Часть задач скрыта (отображается количество видимых и скрытых)
 * - Нет скрытых задач (отображается общее количество) */
function formatTasksSummary(stats: Readonly<{ total: number; excluded: number; }>): string {

    if (stats.total === 0) {
        return '*None in this scope*';
    }

    const displayed = stats.total - stats.excluded;

    if (displayed === 0) {
        return `*All hidden* (hidden: \`${stats.total}\`)`;
    }

    if (stats.excluded > 0) {
        return `\`${displayed}\` (hidden: \`${stats.excluded}\`)`;
    }

    return `\`${stats.total}\``;
}


export default ScopeSection;
