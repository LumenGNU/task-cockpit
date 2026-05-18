/** @file TreeModel/GrowSprouts.ts */
/** @module GrowSprouts */


import Hierarchy from './Hierarchy';
import NodeSpec from './NodeSpec';


type NodeData = NodeSpec.NodeData & { hidden?: boolean; };
type HierarchyConfig = NodeSpec.HierarchyConfig & { showHidden: boolean; };


interface GrowResult<T> {
    sprouts: Readonly<Hierarchy.Data<Readonly<T>> | Hierarchy.Branch<Readonly<T>>>[];
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
function growSprouts<T extends NodeData>(
    nodeData: ReadonlyArray<Readonly<T>>,
    hierarchyConfig: Readonly<HierarchyConfig>,
    ignoreHiddenFlag: boolean,
    compression: NodeSpec.CompressionBehavior
): Readonly<GrowResult<T>> {

    const processed = (hierarchyConfig.showHidden || ignoreHiddenFlag)
        ? nodeData
        : nodeData.filter(function (d) { return !d.hidden; });

    const specs = NodeSpec.createSpecs(
        processed,
        hierarchyConfig,
        compression
    );

    return {
        sprouts: Hierarchy.getRoots(Hierarchy.build<T>(specs)),
        stats: {
            total: nodeData.length,
            excluded: nodeData.length - processed.length
        }
    };
}

export default growSprouts;
