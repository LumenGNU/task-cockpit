/** @file TreeViewPanel/TaskNodeData.ts */

import TaskName from '../TaskName';

/** Данные узла-задачи в иерархии. */
interface TaskNodeData {
    [k: string]: unknown;
    taskLabel: string;
    taskName: TaskName;
};

function isTaskNodeData(raw: unknown): raw is TaskNodeData {
    if (!(raw != null && typeof raw === 'object')) {
        return false;
    }

    if (!('taskLabel' in raw && typeof raw.taskLabel === 'string')) {
        return false;
    }

    if (!('taskName' in raw && TaskName.isTaskName(raw.taskName))) {
        return false;
    }

    return false;
}

const TaskNodeData = {
    isTaskNodeData
};

export default TaskNodeData;
