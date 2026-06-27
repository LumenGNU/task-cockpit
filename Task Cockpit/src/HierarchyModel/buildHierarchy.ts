import createSpecs from './createSpecs';
import Hierarchy from './Hierarchy';
import type CompressionBehavior from './CompressionBehavior';
import type HierarchyElement from './HierarchyElement';
import type ScopedConf from '../Configuration/Resource/Config';
import TaskGroup from '../Configuration/TaskGroup';
import type TaskName from '../TaskName/TaskName';


function buildHierarchy(
    entries: ReadonlyArray<Readonly<{
        name: string;
        groupKind: TaskGroup | null;
        data: { readonly taskName: TaskName; };
    }>>,
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
