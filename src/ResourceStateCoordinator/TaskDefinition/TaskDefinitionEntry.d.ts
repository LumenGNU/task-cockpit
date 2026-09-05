import type TaskDefinition from './TaskDefinition';

interface TaskDefinitionEntry {
    effective: TaskDefinition | null;
    shadowed?: TaskDefinition[];
}


export default TaskDefinitionEntry;
