import {
    Uri,
    workspace
} from 'vscode';
import isWorkspace from './isWorkspace';
import type Scope from './Scope';
import type SourceUri from './SourceUri/SourceUri';


/** Получает URI файла-источника задач ассоциированного с указанною областью.
 *
 * Функция **не проверяет** физическое существование файла на диске — этот файл
 * в любом случае «ассоциирован» существует он или нет. */
function getSourceUri(scope: Scope): SourceUri {

    if (isWorkspace(scope)) {
        return workspace.workspaceFile as SourceUri;
    }

    return Uri.joinPath(scope.uri, '.vscode', 'tasks.json') as SourceUri;
}


export default getSourceUri;
