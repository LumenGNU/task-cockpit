import type TaskDefinition from './TaskDefinition';

interface TaskDefinitionEntry {
    active: TaskDefinition | null;
    shadowed?: TaskDefinition[];
}


export default TaskDefinitionEntry;
