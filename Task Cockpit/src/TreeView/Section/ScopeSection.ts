import {
    MarkdownString,
    ThemeIcon,
    TreeItem,
    TreeItemCollapsibleState,
    type CancellationToken,
    type ProviderResult,
    type Uri
} from 'vscode';
import NodeType from '../NodeType';
import type ContextValue from '../ContextValue';
import type HierarchyElement from '../HierarchyElement';
import type Key from '../../Scope/Key';
import type ScopeInput from '../../ProjectSpace/ScopeInput';
import type ScopeType from '../../Scope/Type';
import formatTooltip from '../formatTooltip';
import NodeId from '../NodeId';


/** `ScopeSection` — ViewModel корневого узла дерева задач для одного scope'а
 * (workspace или папка).
 *
 * Строится из {@linkcode ScopeInput} фабрикой {@linkcode ScopeSection.create}
 * и содержит всё необходимое для рендеринга узла и его дочерней иерархии
 * через `TreeDataProvider`. */
interface ScopeSection {

    /** (*) Уникальный id узла в дереве */
    nodeId: NodeId;

    /** (*) Тип узла. */
    nodeType: NodeType.ScopeSection;

    // /** (**) Родительский узел. (Нет) */
    // parent: null;


    viewData: Readonly<{

        /** (*) Область, отображаемая этой веткой */
        scopeKey: Key;

        /** Элементы модели дерева — результат построения иерархии для данной области.
         * Всегда массив, возможно пустой */
        children: ReadonlyArray<HierarchyElement>;

        /** (*) Отображаемая метка */
        label: string;

        /** Логический тип области */
        scopeType: ScopeType;

        /** Uri источника-задач этой области */
        sourceUri: Uri;

        /** Статистика задач, попавших в это дерево после фильтрации. */
        stats: Readonly<{
            total: number;
            excluded: number;
        }>;
    }>;
}


const ScopeSection = {


    /** Создает секцию для одной области рабочего пространства.
     *
     * Определения задач с флагом `hidden = true` исключаются, если только `hierarchyConfig.showHidden`
     * не выставлен.
     *
     * Компрессия путей в иерархии всегда отключена.
     *
     * @param scopeKey Ключ области, которую отображает ветка
     * @param scopeInput Входные данные из снапшота, описывающие эту область
     *
     * @returns Построенная секция */
    create(
        scopeKey: Key,
        viewData: ScopeSection['viewData']
    ): Readonly<ScopeSection> {

        return {
            nodeId: scopeKey,
            nodeType: NodeType.ScopeSection,
            // parent: null,
            viewData
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
     * `contextValue`: `task-cockpit:Section:Scope:(Global|Workspace|Folder)` */
    getTreeItem(section: Readonly<ScopeSection>): TreeItem {

        return {
            collapsibleState: TreeItemCollapsibleState.Expanded, // @todo
            contextValue: `task-cockpit:Section:Group:Scope:${section.viewData.scopeType}` satisfies ContextValue.Section.Scope,
            description: false,
            iconPath: new ThemeIcon(getIconName(section.viewData.scopeType)),
            id: section.nodeId,
            label: section.viewData.label,
            resourceUri: section.viewData.sourceUri,
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

        item.tooltip = formatTooltip(
            section.viewData.scopeType,
            section.viewData.label || '<unnamed>',
            `$(tools) Tasks: ${formatTasksSummary(section.viewData.stats)}`
        );

        return item;
    },

} as const;


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


function getIconName(scopeType: ScopeType) {
    if (scopeType === 'Folder') {
        return 'root-folder';
    }
    return 'layers';
}


export default ScopeSection;
