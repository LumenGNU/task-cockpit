import type { Uri } from 'vscode';

interface TaskSource {
    uri: Uri;
    JSONPath: readonly ['tasks'] | ['tasks', 'tasks'];
}

export default TaskSource;
