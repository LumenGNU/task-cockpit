import {
    Uri,
    workspace
} from 'vscode';
import isWorkspace from '../Scope/isWorkspace';
import type SourceUri from './SourceUri';
import type Workspace from '../Scope/Workspace/Workspace';
import type Folder from '../Scope/Folder/Folder';


/** Получает URI файла-источника задач ассоциированного с указанною областью.
 *
 * Функция **не проверяет** физическое существование файла на диске — этот файл
 * в любом случае «ассоциирован» существует он или нет. */
function getSourceUri(scope: Workspace | Folder): SourceUri {

    if (isWorkspace(scope)) {
        return workspace.workspaceFile as SourceUri;
    }

    return Uri.joinPath(scope.uri, '.vscode', 'tasks.json') as SourceUri;
}


export default getSourceUri;
