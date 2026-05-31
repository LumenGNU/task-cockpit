import { ItemSeparator, type WorkspaceKey } from '../../constants';
import buildHierarchy from '../../TreeModel/BuildHierarchy';
import NodeType from '../NodeType';
import type Definition from '../../ProjectSpace/Scope/Scope.Definitions.fetchDefinitions';
import type FolderKey from '../../type.d/FolderKey';
import type HierarchyConfig from '../../Configuration/Scoped/HierarchyConfig';
import type NodeConfig from '../../Configuration/Scoped/NodeConfig';
import type Config from '../../Configuration/Global/Config';
import type Key from '../../ProjectSpace/Scope/Key';
import type Hierarchy from '../../TreeModel/Hierarchy';
import type PinsSection from './PinsSection';


interface SubSection {

    /** Тип узла — подсекция закреплённой секции. */
    nodeKey: NodeType.SubSectionKey;

    /** Ключ рабочей области или папки, которой принадлежит подсекция. */
    scopeKey: WorkspaceKey | FolderKey;

    /** Узлы дерева, построенные для данной рабочей области. */
    sprouts: ReadonlyArray<Readonly<Hierarchy.Data<Definition> | Hierarchy.Branch<Definition>>>;

    /** Параметры отображения узлов в данной рабочей области. */
    nodeConfig: Readonly<{
        defaultIconName: string;
        tintLabel: boolean;
        useFolderIcon: boolean;
    }>;

    /** Родительская секция закреплённых задач. */
    parent: PinsSection;

    id: string;

    label: string;
}


const SubSection = {

    /** Строит подсекцию для одной рабочей области внутри секции закреплённых задач.
     *
     * Описания задач с флагом `hidden = true` включаются всегда, независимо от `hierarchyConfig.showHidden`:
     * закреплённые задачи выбраны пользователем явно и должны оставаться видимыми.
     * Степень сжатия путей берётся из `projectSettings.pinned.pathCompression`.
     *
     * @param parent родительская секция (всегда `PinsSection`)
     * @param scopeKey ключ рабочей области или папки
     * @param label отображаемое имя подсекции
     * @param definitions описания задач, закреплённых в данной рабочей области
     * @param nodeConfig параметры отображения узлов
     * @param hierarchyConfig параметры построения иерархии
     * @param projectSettings настройки проекта, определяющие степень сжатия путей
     */
    build(
        parent: PinsSection,
        {
            scopeKey,
            label,
            definitions,
            nodeConfig,
            hierarchyConfig,
            projectSettings
        }: {
            scopeKey: Key,
            label: string,
            definitions: ReadonlyArray<Readonly<Definition>>,
            nodeConfig: Readonly<NodeConfig>,
            hierarchyConfig: Readonly<HierarchyConfig>,
            projectSettings: Readonly<Config>;
        }): Readonly<SubSection> {

        // Кешированный идентификатор узла.
        // let _id: string | undefined;
        return {
            parent,
            nodeKey: NodeType.SubSectionKey,
            scopeKey,
            label,
            nodeConfig,
            ...buildHierarchy({
                nodeData: definitions,
                hierarchyConfig,
                ignoreHiddenFlag: true,
                compression: projectSettings.pinned.pathCompression
            }),
            get id() {
                return _id ??= `${this.parent.id}${ItemSeparator}${this.scopeKey}`;
            }
        } as const;
    }
};


export default SubSection;
