import type EligibleTask from './EligibleTask/EligibleTask';
import type ResourceConfig from './ResourceConfig/ResourceConfig';
import type TaskDefinitionEntry from './TaskDefinition/TaskDefinitionEntry';
import type TaskName from '../TaskName';


interface OriginCacheBundle {
    eligibleTasksMap: Map<TaskName, EligibleTask> | null;
    nodeConfig: ResourceConfig['Node'] | null;
    taskDefinitionsMap: Map<TaskName, TaskDefinitionEntry> | null;
}

export default OriginCacheBundle;
