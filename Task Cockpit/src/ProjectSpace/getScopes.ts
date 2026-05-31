import {
    workspace,
    TaskScope
} from 'vscode';
import type Scope from '../Scope/Scope.d';
import type Folder from '../Scope/Folder/Folder.d';


/** Возвращает области-источники задач, структурно присутствующие в проекте.
 *
 * Структурный факт — без учёта настроек или фильтрации.
 *
 * **Инвариант:** `TaskScope.Workspace`, если присутствует — всегда первый.
 * workspaceFolders — в порядке полученном от VS Code.
 * */
function getScopes(): ReadonlyArray<Readonly<Scope>> {
    return [
        ...(workspace.workspaceFile ? [TaskScope.Workspace] as const : []),
        ...(workspace.workspaceFolders ?? []) as Folder[]
    ] as const;
}


export default getScopes;
