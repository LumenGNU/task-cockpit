/** @file TreeModel/GrowSprouts.ts */
/** @module GrowSprouts */


import Hierarchy from './Hierarchy';
import NodeSpec from './NodeSpec';


type NodeData = NodeSpec.NodeData & { hidden?: boolean; };
type HierarchyConfig = NodeSpec.HierarchyConfig & { showHidden: boolean; };


interface GrowResult<T> {
    sprouts: ReadonlyArray<Readonly<Hierarchy.Data<Readonly<T>> | Hierarchy.Branch<Readonly<T>>>>;
    stats: Readonly<{
        total: number;
        excluded: number;
    }>;
}


/** Преобразует плоский список узловых данных в корневые узлы иерархии.
 *
 * Скрытые узлы исключаются, если не разрешены явно — через конфигурацию или флаг.
 * Возвращает корневые узлы построенной иерархии и статистику по исключённым элементам.
 *
 * @param nodeData исходные данные узлов
 * @param hierarchyConfig параметры иерархии, в том числе политика видимости скрытых узлов
 * @param ignoreHiddenFlag если `true`, скрытые узлы включаются независимо от конфигурации
 * @param compression режим компрессии путей в иерархии */
function growSprouts<D extends NodeData>({
    nodeData,
    ignoreHiddenFlag,
    hierarchyConfig,
    compression
}: {
    nodeData: ReadonlyArray<Readonly<[name: string, data: D]>>;
    ignoreHiddenFlag: boolean;
    hierarchyConfig: Readonly<HierarchyConfig>;
    compression: NodeSpec.CompressionBehavior;
}): Readonly<GrowResult<D>> {

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

export default growSprouts;
