import createSpecs, { type CompressionBehavior } from './createSpecs';
import Hierarchy from './Hierarchy';
import type HierarchyElement from './HierarchyElement';
import type ScopedConf from '../Configuration/Scoped/Config';
import type TaskName from '../type.d/TaskName';
import TaskGroup from '../Scope/TaskSource/Definitions/Definition/TaskGroup';


function buildHierarchy(
    // @fixme Почему кортеж а не объект???
    entries: ReadonlyArray<Readonly<[name: string, groupKind: TaskGroup | null, data: { readonly taskName: TaskName; }]>>,
    hierarchyConfig: Readonly<ScopedConf['Hierarchy']>,
    pathCompression: CompressionBehavior,
): ReadonlyArray<HierarchyElement> {

    return Hierarchy.getRoots(Hierarchy.build<{ readonly taskName: TaskName; }>(
        createSpecs({
            entries,
            hierarchyConfig,
            pathCompression
        })
    ));
}


export default buildHierarchy;
