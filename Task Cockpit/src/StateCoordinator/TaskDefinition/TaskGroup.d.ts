import type Group from './Group';

interface TaskGroup {
    /** Капитализированное имя группы */
    kind: Group;
    isDefault: boolean;
}

export default TaskGroup;
