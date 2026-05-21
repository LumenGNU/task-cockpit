/** @file TreeModel/BuildHierarchy.ts */
/** @module BuildHierarchy */


import Hierarchy from './Hierarchy';
import NodeSpec from './NodeSpec';


type NodeData = NodeSpec.NodeData & { hidden?: boolean; };
type HierarchyConfig = NodeSpec.HierarchyConfig & { showHidden: boolean; };


interface BuildResult<T> {
    sprouts: ReadonlyArray<Readonly<Hierarchy.Data<Readonly<T>> | Hierarchy.Branch<Readonly<T>>>>;
    stats: Readonly<{
        total: number;
        excluded: number;
    }>;
}


/** Преобразует плоский список узловых данных в корневые узлы иерархии.
 *
 * Скрытые узлы исключаются, если не разрешены явно — через конфигурацию или флаг.
 * Возвращает корневые узлы построенной иерархии и статистику по исключённым элементам. */
function buildHierarchy<D extends NodeData>({
    nodeData,
    ignoreHiddenFlag,
    hierarchyConfig,
    compression
}: {
    /** Исходные данные узлов */
    nodeData: ReadonlyArray<Readonly<[name: string, data: D]>>;
    /** Параметры иерархии, в том числе политика видимости скрытых узлов */
    hierarchyConfig: Readonly<HierarchyConfig>;
    /** Если `true`, скрытые узлы включаются независимо от флага `showHidden` и политики видимости */
    ignoreHiddenFlag: boolean;
    /** Режим компрессии путей в иерархии */
    compression: NodeSpec.CompressionBehavior;
}): Readonly<BuildResult<D>> {

    const nodeDataItems = (hierarchyConfig.showHidden || ignoreHiddenFlag)
        ? nodeData
        : nodeData.filter(function ([_, d]) { return !d.hidden; });

    const specs = NodeSpec.createSpecs({
        nodeDataItems,
        hierarchyConfig,
        compression
    });

    return {
        sprouts: Hierarchy.getRoots(Hierarchy.build<D>(specs)),
        stats: {
            total: nodeData.length,
            excluded: nodeData.length - nodeDataItems.length
        }
    };
}

export default buildHierarchy;
