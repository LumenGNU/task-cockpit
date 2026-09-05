/** @file ResourceStateCoordinator/TaskSource.ts */

import { Uri } from 'vscode';

interface TaskSource {
    uri: Uri;
    JSONPath: readonly ['tasks'] | ['tasks', 'tasks'];
}

function isTaskSource(raw: unknown): raw is TaskSource {

    if (!(raw != null && typeof raw === 'object')) {
        return false;
    }

    if (!('uri' in raw && raw.uri instanceof Uri)) {
        return false;
    }

    if (!('JSONPath' in raw && Array.isArray(raw.JSONPath))) {
        return false;
    }

    if (raw.JSONPath.length < 1 || raw.JSONPath.length > 2) {
        return false;
    }

    if (!raw.JSONPath.every(item => item === 'tasks')) {
        return false;
    }

    return true;

}

const TaskSource = {
    isTaskSource
};

export default TaskSource;
