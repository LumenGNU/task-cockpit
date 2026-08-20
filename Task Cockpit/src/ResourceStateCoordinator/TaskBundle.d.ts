import type EligibleTask from './EligibleTask/EligibleTask';
import type TaskDefinition from './TaskDefinition/TaskDefinition';
import type ResourceConfig from './ResourceConfig/ResourceConfig';


interface TaskBundle {
    nodeConfig: ResourceConfig['Node'] | null;
    taskDefinition: TaskDefinition | null;
    eligibleTask: EligibleTask | null;
}

export default TaskBundle;
