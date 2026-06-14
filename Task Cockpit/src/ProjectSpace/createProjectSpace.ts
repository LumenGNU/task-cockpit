import {
    CancellationError,
    TaskScope,
    type CancellationToken,
    type ConfigurationChangeEvent,
    type WorkspaceFoldersChangeEvent,
    workspace
} from 'vscode';
import createReader from '../Configuration/Scoped/createReader';
import fetchDefinitions from '../Scope/TaskSource/fetchDefinitions';
import getDisplayName from '../Scope/getDisplayName';
import getKey from '../Scope/getKey';
import getSourceUri from '../Scope/getSourceUri';
import isWorkspace from '../Scope/isWorkspace';
import readConfig from '../Scope/readConfig';
import resolveTaskSource from '../Scope/resolveTaskSource';
import type ProjectSpace from './ProjectSpace';
import type Reader from '../Configuration/Scoped/Reader';
import type ScopeInput from './ScopeInput';
import type ProjectMap from './ProjectMap';
import type Scope from '../Scope/Scope.d';
import type Folder from '../Scope/Folder/Folder.d';


function createProjectSpace(configSectionName: string): ProjectSpace {

    // Читатель конфигурации
    const reader = createReader(configSectionName);

    return {
        getScopes,
        shouldRebuildSnapshot(event: ConfigurationChangeEvent) { return shouldRebuildSnapshot(event, configSectionName); },

        /*
         * @throws { CancellationError } при отмене через `token`.
         *  */
        async buildSnapshot(scopes: ReadonlyArray<Readonly<Scope>>, token: CancellationToken) {
            return await buildSnapshot(scopes, reader, token);
        }
    } as const;

}


/** Возвращает области-источники задач, структурно присутствующие в проекте.
 *
 * Структурный факт — без учёта настроек или фильтрации.
 *
 * **Инвариант:** `TaskScope.Workspace`, если присутствует — всегда первый.
 * workspaceFolders — в порядке полученном от VS Code.
 * */
function getScopes(): ReadonlyArray<Readonly<Scope>> {
    return [
        // @todo Global
        ...(workspace.workspaceFile ? [TaskScope.Workspace] as const : []),
        ...(workspace.workspaceFolders ?? []) as Folder[]
    ] as const;
}



function shouldRebuildSnapshot(
    event: ConfigurationChangeEvent | WorkspaceFoldersChangeEvent,
    configSectionName: string
): boolean {

    if ('affectsConfiguration' in event) {
        // @todo  supports dotted names
        return event.affectsConfiguration(configSectionName) || event.affectsConfiguration('tasks');
    }

    return true;
}


/** Собирает снимок данных по переданным областям рабочего пространства..
 *
 * Ключи результата упорядочены в соответствии с `scopes`.
 *
 *  * **Замечания:**:
 * - Порядок семантически значим — он определяет
 *   порядок при отображении в UI.
 *   Важно повторять порядок полученный от VS Code.
 *
 * Создаётся непосредственно перед построением дерева и не кэшируется
 * в этом модуле — решение о повторном использовании принимает вызывающая сторона.
 *
 * @param scopes области рабочего пространства (как правило, результат
 *   `getScopes` после применения фильтрации).
 * @param token токен отмены.
 *
 * @throws { CancellationError } при отмене через `token`.
 *  */
async function buildSnapshot(
    scopes: ReadonlyArray<Readonly<Scope>>,
    configReader: Reader,
    token: CancellationToken
): Promise<ProjectMap> {

    if (token.isCancellationRequested) {
        throw new CancellationError();
    }

    // Единственное что ожидается это {@linkcode CancellationError} при
    // срабатывании токена отмены.
    const entries = await Promise.all(

        scopes.map(async (scope) => {

            const taskSource = await resolveTaskSource(scope);

            if (token.isCancellationRequested) {
                throw new CancellationError();
            }

            // fetchDefinitions бросает только CancellationError
            const definitions = taskSource
                ? await fetchDefinitions(taskSource, token)
                : new Map(); // если taskSource не разрешается в существующий файл

            // Возвращаем кортеж для конструктора Map
            return [
                getKey(scope),
                {
                    label: getDisplayName(scope),
                    scopeType: isWorkspace(scope) ? 'Workspace' : 'Folder',
                    config: readConfig(scope, configReader),
                    sourceUri: getSourceUri(scope),
                    definitions
                } satisfies ScopeInput
            ] as const;
        })
    );

    if (token.isCancellationRequested) {
        throw new CancellationError();
    }

    return new Map(entries);
}

export default createProjectSpace;
