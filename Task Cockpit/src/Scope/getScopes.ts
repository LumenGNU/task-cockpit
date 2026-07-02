import {
    TaskScope,
    workspace
} from 'vscode';
import Folder from './Folder/Folder';


function getScopes() {
    return [
        // @todo Global
        // **Инвариант:** `TaskScope.Workspace`, если присутствует — всегда первый.
        // workspaceFolders — в порядке полученном от VS Code.
        ...(workspace.workspaceFile ? [TaskScope.Workspace] as const : []),
        ...(workspace.workspaceFolders ?? []) as Folder[]
    ] as const;
}


export default getScopes;
