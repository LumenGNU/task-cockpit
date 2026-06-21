import {
    TaskScope,
    workspace,
    Uri
} from 'vscode';
import Folder from './Scope/Folder/Folder';
import getKey from './Scope/getKey';
import ScopeKey from './Scope/Key';
import TaskName from './type.d/TaskName';

export async function readScopedPins(): Promise<Array<{ scopeKey: ScopeKey; pinnedTasks: TaskName[]; }>> {

    const entries: Array<{ scopeKey: ScopeKey; pinnedTasks: TaskName[]; }> = [];

    const scopes = [
        ...(workspace.workspaceFile ? [TaskScope.Workspace] as const : []),
        ...(workspace.workspaceFolders ?? []) as Folder[]
    ] as const;

    for (const scope of scopes) {
        const uri =
            scope === TaskScope.Workspace
                ? Uri.joinPath(workspace.workspaceFile!, '..', 'pins.json')
                : Uri.joinPath(scope.uri, 'pins.json');
        try {
            const raw = await workspace.fs.readFile(uri);
            const pinnedTasks = JSON.parse(new TextDecoder().decode(raw)) as TaskName[];
            entries.push({ scopeKey: getKey(scope), pinnedTasks });
        } catch {
            // нет файла — нет пинов
        }
    }

    return entries;
}
