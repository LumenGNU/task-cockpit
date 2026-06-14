import Hierarchy from '../TreeModel/Hierarchy';
import NodeSpec from '../TreeModel/NodeSpec';
import type Config from '../Configuration/Scoped/Config';
import type Definitions from '../Scope/TaskSource/Definitions/Definitions';
import type HierarchyElement from './HierarchyElement';
import type TaskName from '../type.d/TaskName';
import type Definition from '../Scope/TaskSource/Definitions/Definition/Definition';


function buildHierarchy({
    definitions,
    filter,
    hierarchyConfig,
    pathCompression,
}: {
    definitions: Definitions,
    filter?: (taskName: TaskName, definition: Definition) => boolean;
    hierarchyConfig: Readonly<Config['hierarchyConfig']>,
    pathCompression: NodeSpec.CompressionBehavior;
}): Readonly<{
    children: ReadonlyArray<HierarchyElement>;
    stats: Readonly<{
        total: number;
        excluded: number;
    }>;
}> {

    const entries: [TaskName, { taskName: TaskName; }][] = [];
    for (const [taskName, definition] of definitions) {
        if (!filter || filter(taskName, definition)) {
            entries.push([taskName, { taskName }]);
        }
    }

    return {
        children: Hierarchy.getRoots(Hierarchy.build<{ readonly taskName: TaskName; }>(
            NodeSpec.createSpecs({
                entries,
                hierarchyConfig,
                pathCompression
            })
        )),
        stats: {
            total: definitions.size,
            excluded: definitions.size - entries.length
        } as const
    } as const;
}


export default buildHierarchy;
