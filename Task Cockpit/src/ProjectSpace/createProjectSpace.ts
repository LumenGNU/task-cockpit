import {
    CancellationError,
    TaskScope,
    type CancellationToken,
    CancellationTokenSource,
    workspace,
    LogOutputChannel
} from 'vscode';
// import type Scope from '../Scope/Scope.d';
import buildHierarchy from '../HierarchyModel/buildHierarchy';
import createScopedReader from '../Configuration/Scoped/createReader';
import fetchDefinitions from '../Scope/TaskSource/fetchDefinitions';
import getDisplayName from '../Scope/getDisplayName';
import getKey from '../Scope/getKey';
import getSourceUri from '../Scope/getSourceUri';
import getType from '../Scope/getType';
import resolveTaskSource from '../Scope/resolveTaskSource';
import type Definition from '../Scope/TaskSource/Definitions/Definition/Definition';
import type DefinitionId from '../EligibleTask/DefinitionId';
import type Folder from '../Scope/Folder/Folder.d';
import type GlobalConfig from '../Configuration/Global/Config';
import type ScopeData from './ScopeData';
import type ScopedConfig from '../Configuration/Scoped/Config';
import type ScopeKey from '../Scope/Key';
import type ScopeMap from './ScopeMap';
import type ScopeType from '../Scope/Type';
import type SourceUri from '../Scope/SourceUri/SourceUri';
import type TaskName from '../type.d/TaskName';
import type TaskSource from '../Scope/TaskSource/TaskSource';
import TaskGroup from '../Scope/TaskSource/Definitions/Definition/TaskGroup';


/**
 * @throws { never }
 *  */
function createProjectSpace(
    baseConfigSection: string,
    logOutputChannel: LogOutputChannel | null = null
) {

    // Читатель per-scope конфигурации
    const scopedReader = createScopedReader(baseConfigSection);

    let currentSource: CancellationTokenSource | undefined;

    return {

        /** Строит снимок данных для всех областей.
         *
         * Реализация выполняет
         * чтение конфигурации, обращения к VS Code API и формирует
         * полное представление задач для каждой из областей.
         *
         * Реализация выбросит `CancellationError` когда??????????????.
         *
         * @returns Promise, разрешающийся в `Snapshot` с данными
         *   по всем переданным областям.
         *
         * @throws { CancellationError } — прерывается повторным вызовом.
         *  */
        async buildSnapshot(
            projectSpaceConf: Readonly<GlobalConfig['ProjectSpaceConf']>,
            userProps: ReadonlyMap<ScopeKey, { pins: ReadonlyMap<TaskName, DefinitionId | null> | null; }>,
        ): Promise<Readonly<ScopeMap>> {
            currentSource?.cancel();
            currentSource?.dispose();

            const source = new CancellationTokenSource();
            currentSource = source;

            const scopes = [
                // @todo Global
                // **Инвариант:** `TaskScope.Workspace`, если присутствует — всегда первый.
                // workspaceFolders — в порядке полученном от VS Code.
                ...(workspace.workspaceFile ? [TaskScope.Workspace] as const : []),
                ...(workspace.workspaceFolders ?? []) as Folder[]
            ] as const;


            try {
                //  **Замечания:**:
                //  Порядок семантически значим — он определяет
                //  порядок при отображении в UI.
                //  Важно повторять порядок полученный от VS Code.

                const scopePromises = scopes.map(async function (scope) {
                    const scopeKey = getKey(scope);
                    return buildScopedSnapshot(
                        scopeKey,
                        getType(scope),
                        getSourceUri(scope),
                        await resolveTaskSource(scope),
                        getDisplayName(scope),
                        scopedReader.read(scope),
                        userProps.get(scopeKey),
                        projectSpaceConf,
                        source.token
                    );
                });

                scopePromises.forEach(function (p) {
                    p.catch(function (error) {
                        if (!(error instanceof CancellationError)) {
                            logOutputChannel?.error(`buildSnapshot: an unexpected exception in buildScopedSnapshot, errorType=${error?.constructor?.name ?? typeof error}`);
                        };
                    });
                });

                return new Map(await Promise.all(scopePromises));
            }
            finally {
                if (currentSource === source) {
                    currentSource = undefined;
                }
                source.dispose();
            }
        }
    } as const;

}


/** Строит снимок состояния области рабочего пространства: загружает определения задач,
 * применяет фильтрацию по настройкам области и глобальным исключениям,
 * вычисляет иерархии задач и закреплённых элементов.
 *
 * Если источник задач не разрешается в существующий файл, определения считаются пустыми.
 *
 * Поведение при фильтрации задач:
 * - если `label` области входит в `globalConf.filtering.excludeFolders` —
 *   список отфильтрованных задач равен `null`, иерархия задач не строится — `scopeHierarchy = null`,
 *   все задачи области считаются скрытыми;
 * - если `scopedConf.Filtering.showHidden` равен `false` — из списка исключаются задачи
 *   с флагом `definition.hidden === true`;
 * - если `scopedConf.Filtering.showHidden` равен `true` — список содержит все задачи.
 *
 * Поведение при построении иерархии закреплённых задач:
 * - если `globalConf.pins.visibility` равен `false` или `userProps.pins` равен `null` —
 *   иерархия пинов не строится — `pinHierarchy = null`.
 *
 * @param scope Область рабочего пространства.
 * @param scopedConf Конфигурация области: параметры фильтрации, иерархии и отображения узлов.
 * @param scopedUserProps Пользовательские свойства области:
 *   - закреплённые задачи.
 * @param projectSpaceConf Глобальная конфигурация пространства проектов:
 *   - исключения папок
 *   - настройки пинов.
 * @param token Токен отмены.
 *
 * @returns Кортеж `[ScopeKey, ScopeData]` — ключ области и её снимок.
 *   Или `[ScopeKey, null]` — ???????
 *
 * @throws { CancellationError } если `token` запрашивает отмену в ходе выполнения.
 * */
async function buildScopedSnapshot(
    scopeKey: ScopeKey,
    type: ScopeType,
    sourceUri: SourceUri,
    taskSource: Readonly<TaskSource> | null,
    label: string,
    scopedConf: Readonly<ScopedConfig>,
    scopedUserProps: Readonly<{ pins: ReadonlyMap<TaskName, DefinitionId | null> | null; }> | undefined,
    projectSpaceConf: Readonly<GlobalConfig['ProjectSpaceConf']>,
    token: CancellationToken
): Promise<[ScopeKey, Readonly<ScopeData> | null]> {


    if (token.isCancellationRequested) {
        throw new CancellationError();
    }

    const scopeExcluded = projectSpaceConf.filtering.excludeFolders.has(label);

    const hasPins = scopedUserProps?.pins?.size;
    const showPinsSection = projectSpaceConf.pins.visibility && hasPins;

    // console.error('pinsCount=', scopedUserProps?.pins?.size);
    // console.error('hasPins=', hasPins);
    // console.error('visibility=', projectSpaceConf.pins.visibility);
    // console.error('showPinsSection=', `секция ${showPinsSection ? '' : 'НЕ'} будет показана`);

    if (scopeExcluded && !hasPins) {
        // если область скрыта И нет пинов
        return [scopeKey, null];
    }

    // по контракту fetchDefinitions бросает только CancellationError
    const definitions = taskSource
        ? await fetchDefinitions(taskSource, token)
        : new Map<TaskName, Readonly<Definition>>(); // если taskSource не разрешается в существующий файл

    if (token.isCancellationRequested) {
        throw new CancellationError();
    }

    const filteredNames =
        scopeExcluded
            ? null
            : [...definitions.entries()].reduce(
                function (acc, [taskName, definition]) {
                    if (!scopedConf.Filtering.showHidden && definition.hidden) {
                        return acc;
                    }
                    acc.push([taskName, definition.group, { taskName }]);
                    return acc;
                }, [] as Readonly<[name: string, groupKind: TaskGroup | null, data: { readonly taskName: TaskName; }]>[]);

    const total = definitions.size;
    const hiddenCount =
        filteredNames
            ? total - filteredNames.length
            : total;

    const pinnedNames =
        showPinsSection
            ? [...scopedUserProps.pins.keys()].reduce(
                function (acc, taskName) {
                    const definition = definitions.get(taskName);
                    if (!definition) {
                        return acc;
                    }
                    acc.push([taskName, definition.group, { taskName }]);
                    return acc;
                }, [] as Readonly<[name: string, groupKind: TaskGroup | null, data: { readonly taskName: TaskName; }]>[])
            : null;

    return [scopeKey, {
        label,
        type,
        sourceUri: sourceUri,
        nodeConfig: scopedConf.Node,
        definitions,
        detail: { total, hiddenCount },
        userProps: scopedUserProps ?? null,
        scopeHierarchy: filteredNames ? buildHierarchy(filteredNames, scopedConf.Hierarchy, 'off') : null,
        pinHierarchy: pinnedNames && pinnedNames.length > 0 ? buildHierarchy(pinnedNames, scopedConf.Hierarchy, projectSpaceConf.pins.pathCompression) : null,
    } satisfies ScopeData];
}


export default createProjectSpace;
