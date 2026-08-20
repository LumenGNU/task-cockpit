import type Group from './Group';

interface TaskGroup {
    /** Капитализированное имя группы */
    isDefault: boolean;
    kind: Group;
}

export default TaskGroup;
