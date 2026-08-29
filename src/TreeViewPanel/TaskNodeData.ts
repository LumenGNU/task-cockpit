/** @file TreeViewPanel/TaskNodeData.ts */

import TaskName from '../TaskName';
import TaskSource from '../ResourceStateCoordinator/TaskSource';
import OriginKey from '../OriginKey';


/** Данные узла-задачи в иерархии. */
interface TaskNodeData {
    [k: string]: unknown;
    taskLabel: string;
    taskName: TaskName;
    taskOrigin: OriginKey;
    taskSource: TaskSource | null;
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

    if (!('taskOrigin' in raw && OriginKey.isOriginKey(raw.taskOrigin))) {
        return false;
    }

    if ('taskSource' in raw) {
        if (raw.taskSource === null) {
            return true;
        }
        if (TaskSource.isTaskSource(raw.taskSource)) {
            return true;
        }
    }

    return false;
}

const TaskNodeData = {
    isTaskNodeData
};

export default TaskNodeData;
