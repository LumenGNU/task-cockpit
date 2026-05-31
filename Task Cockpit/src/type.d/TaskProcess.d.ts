// @todo на удаление?

import TaskId from "./TaskId";

/**
 * Процесс задачи
 * */
export interface TaskProcess {
    taskId: TaskId;
    running: boolean;
    timestamp: number;
}
