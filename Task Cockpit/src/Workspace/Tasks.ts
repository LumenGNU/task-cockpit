/** @file Cockpit/Workspace/Tasks.ts */
/** @module Tasks */

import * as JSONC from 'jsonc-parser';
import * as vscode from 'vscode';
import helpers from '../helpers';
import type * as TC from '../types';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


/** Извлекает задачи из указанных областей.
 *
 * Возвращает две карты, ключом в которых служит {@linkcode TC.ScopeFile}:
 * - `tasksByFile` — объекты {@linkcode vscode.Task}, прошедшие два фильтра:
 *     - "подходящие" — те, для которых удалось {@link helpers.buildId | построить ID};
 *     - имеют *именованное* определение в файле-источнике задач.
 * - `definitionsByFile` — {@link TC.TaskDefinition | определения задач}, прочитанные из файла-источника.
 *   Определения, для которых VS Code не создал соответствующий
 *   {@linkcode vscode.Task} (отклонил или ещё не загрузил), помечаются
 *   флагом `isBroken`.
 *
 * **Порядок ключей** в обеих картах соответствует порядку `scopes` на входе,
 * порядок записей внутри — порядку определений в файле-источнике.
 *
 * Работает сразу со всем набором областей, а не с каждой по отдельности:
 * {@linkcode vscode.tasks.fetchTasks} не умеет фильтровать по области и
 * всегда возвращает полный список. Поэтому индекс задач строится один раз
 * на вызов, а дальше разбирается по областям через определения из файлов.
 * 
 * @param scopes Области действия извлекаемых задач.
 * @param ctsToken Токен отмены.
 *
 * @throws {vscode.CancellationError} при срабатывании токена отмены. */
async function fetch(
    scopes: ReadonlyArray<TC.Scope>,
    ctsToken: vscode.CancellationToken
): Promise<Readonly<TC.FetchResult>> {

    if (ctsToken.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    // индекс всех "подходящих" задач от VS Code
    const tasksIndex = await fetchTaskIndex(ctsToken);

    if (ctsToken.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    const tasksByFile: TC.TasksByFile = new Map();
    const definitionsByFile: TC.DefinitionsByFile = new Map();

    // Перебираем в порядке "по папкам"
    for (const scope of scopes) {

        const uri = scope.scopeURI;

        // резистентен к ошибкам, выбрасывает только `vscode.CancellationError`
        const scopedDefinitions: TC.ScopedDefinitions = await readDefinitions(uri, ctsToken);

        if (ctsToken.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        const scopedTasks: TC.ScopedTasks = new Map();

        // Перебираем определения в порядке "из файла".
        // Фильтруем tasksIndex в scopedTasks.
        // Помечаем "сломанные" определения
        for (const [name, definition] of scopedDefinitions) {

            const vTask = tasksIndex[definition.id];

            if (vTask) {
                scopedTasks.set(name, vTask);
            }
            else {
                // У задачи есть определение в файле-задач, но
                // VS Code не создала из него `vscode.Task` —
                // такое определение считается сломанным.
                definition.isBroken = true;

                // #region DEBUG
                log(LogLevel.Warning, `No vscode.Task for definition: Name=${name}; Scope=${scope.folderName}`);
                // #endregion DEBUG
            }
        }

        const scopeFile = uri.fsPath;
        tasksByFile.set(scopeFile, scopedTasks);
        definitionsByFile.set(scopeFile, scopedDefinitions);

    }

    if (ctsToken.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    // #region DEBUG
    let totalDefinitions = 0;
    for (const definitions of definitionsByFile.values()) {
        totalDefinitions += definitions.size;
    }
    let totalTasks = 0;
    for (const tasks of tasksByFile.values()) {
        totalTasks += tasks.size;
    }

    let indexedCount = 0;
    for (const _ in tasksIndex) { ++indexedCount; }

    const scopeCount = definitionsByFile.size;

    const unmatchedInIndex = indexedCount - totalTasks;
    const unmatchedSuffix = unmatchedInIndex > 0
        ? `; ${unmatchedInIndex} indexed task(s) have no file definition`
        : '';

    const summary = totalTasks === totalDefinitions
        ? `Cockpit fetched ${totalTasks} task(s) across ${scopeCount} scope(s)${unmatchedSuffix}`
        : `Cockpit fetched ${totalTasks} task(s) from ${totalDefinitions} definition(s) across ${scopeCount} scope(s)${unmatchedSuffix}`;

    log(LogLevel.Debug, summary);
    // #endregion DEBUG


    return {
        tasksByFile,
        definitionsByFile
    };
}


/** Строит индекс "подходящих" задач из полного списка, полученного
 * от VS Code.
 *
 * "Подходящими" считаются задачи, для которых {@link helpers.resolveId}
 * смог построить ID (например, виртуальные или глобальные задачи
 * отсеиваются). Критерий инкапсулирован в `resolveId` — этот модуль
 * им только пользуется.
 *
 * @note Константа {@linkcode vscode.TaskScope.Global} в API присутствует,
 *   но задач с такой областью не встречается — глобальные задачи
 *   приходят с областью `Workspace` и от остальных отличаются
 *   внутри {@link helpers.resolveId}.
 *
 * @param ctsToken Токен отмены.
 * @returns Индекс подходящих задач по ID. Отсутствие конкретного ID —
 *   нормальная ситуация, вызывающий не должен этого ожидать.
 *
 * @throws {vscode.CancellationError} при срабатывании токена отмены. */
async function fetchTaskIndex(ctsToken: vscode.CancellationToken): Promise<Record<TC.TaskId, vscode.Task>> {

    if (ctsToken.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    // Индекс всех "подходящих" задач, полученных от VS Code
    const index = Object.create(null) as Record<TC.TaskId, vscode.Task>;

    const fetchedTasks = await vscode.tasks.fetchTasks();

    if (ctsToken.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    // Отобрать подходящие задачи и проиндексировать по ID,
    // пропуская "не подходящие"
    for (const task of fetchedTasks) {

        const taskId = helpers.resolveId(task);
        // id не создается для "не подходящих" задач
        if (!taskId) {

            // #region DEBUG
            const scopeLabel = task.scope === undefined
                ? 'undefined'
                : typeof task.scope === 'number'
                    ? 'Workspace'
                    : task.scope.name;
            log(LogLevel.Trace, `Task filtered out: Name="${task.name || '<unlabeled>'}"; Scope="${scopeLabel}"`);
            // #endregion DEBUG

            continue;
        }

        index[taskId] = task;
    }

    // #region DEBUG
    const total = fetchedTasks.length;
    log(LogLevel.Debug, `${vscode.env.appName} reports ${total} total task(s)`);
    var indexed = 0;
    var _;
    for (_ in index) { ++indexed; }
    const outOf = total - indexed;
    log(LogLevel.Debug, `Cockpit indexed ${indexed} task(s)${outOf > 0 ? `; ${outOf} filtered out` : ''}`);
    // #endregion DEBUG

    return index;
}

// #region Definitions -- парсинг источника задач


/** Сырой массив определений, извлечённый из файла-источника.
 * 
 * Минимальный набор полей, нужный для представления задачи */
interface Raw {
    label?: string;
    hide?: boolean;
    icon?: TC.IconDefinition;
    group?: string | { kind: string; isDefault?: boolean; };
    isBackground?: boolean;
}


/** Загружает определения задач напрямую из файла-источника.
 *
 * - Парсит файл самостоятельно.
 * - Гарантирует порядок задач как в файле.
 *
 * Не выбрасывает IO/Parsing/etc исключений — при любых ошибках чтения
 * или парсинга возвращает пустую карту. Обслуживание файла-источника
 * не наша ответственность, этим занимается VS Code.
 *
 * @param uri URI файла-источника задач (не обязан существовать физически).
 * @param ctsToken Токен отмены.
 * @returns Карта определений задач; пуста при ошибках чтения/парсинга.
 *
 * @throws {vscode.CancellationError} при срабатывании токена отмены —
 *   единственное исключение, которое пробрасывается наружу. */
async function readDefinitions(
    uri: TC.ScopeUri,
    ctsToken: vscode.CancellationToken
): Promise<Map<TC.TaskName, TC.TaskDefinition>> {

    if (ctsToken.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    try {
        const uint8Array = await vscode.workspace.fs.readFile(uri);

        if (ctsToken.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        // Чтение/валидация определений задач из содержимого файла.
        // Никак не реагируем на ошибки, обслуживание файла-источника
        // задач — не наша ответственность.
        return remapRaw(uri.fsPath,
            extract(
                new TextDecoder('utf-8').decode(uint8Array),
                helpers.resolveJsonPath(uri)
            )
        );

    }
    catch (error) {

        if (error instanceof vscode.CancellationError) {
            // Пробрасываем отмену
            throw error;
        }

        // #region DEBUG
        // Отсутствие файла - нормальная ситуация
        if (error instanceof Error && 'code' in error && error.code === 'FileNotFound') {
            log(LogLevel.Trace, `Tasks file does not exist, skipping`, uri.fsPath);
        }
        else {
            // Проблемы с файлом/чтением/парсингом (или, например, там каталог - не файл) — не наши проблемы, VS Code разберётся
            const reason = error instanceof Error ? error.message : JSON.stringify(error);
            log(LogLevel.Debug, `Tasks file processing error, skipping: ${reason}`, uri.fsPath);
        }
        // #endregion DEBUG
        // Единственное, как реагируем: "в этой области задач нет" 
        // (или "не нашли", или "не смогли"... нам все равно — "ИХ НЕТ". 
        // А за причинами обращайтесь к VS Code)
        return new Map();
    }
}


/** Извлечение массива задач из JSONC-содержимого.
 *
 * @param jsoncContent JSONC содержимое файла источника задач
 * @param jsonPath Путь к массиву задач внутри структуры */
function extract(jsoncContent: string, jsonPath: JSONC.JSONPath): Raw[] {

    // Парсинг JSONC
    const parsed = JSONC.parse(
        jsoncContent,
        undefined, // не собираемся обрабатывать ошибки
        {
            // настройки совместимости с VS Code
            allowEmptyContent: true,
            allowTrailingComma: true
        }
    );

    // Извлекаем массив задач по пути `jsonPath`.
    // (разный для .json и .code-workspace файлов)
    const raw = jsonPath.reduce((node, key) => {
        return node?.[key];
    }, parsed);
    // Не массив — не наша проблема (VS Code разберётся), 
    // а мы всегда возвращаем массив
    return Array.isArray(raw) ? raw : [];
}


/** Преобразует сырой массив определений задач в карту определений.
 *
 * Выполняется минимальная валидация:
 * - записи, не являющиеся объектами, пропускаются;
 * - записи без `label` или с невалидным `label` пропускаются;
 * - для принятых записей строится ID через {@link helpers.buildId}.
 *
 * Поле `group` нормализуется: строковая форма приводится к объектной,
 * первая буква `kind` — к верхнему регистру. 
 * 
 * Поле `icon` всегда присутствует в результате как объект (возможно,
 * с пустыми полями).
 * 
 * Остальные поля переносятся как есть; валидация их содержимого не
 * наша ответственность.
 *
 * Дубликаты `label` молча перезаписываются — побеждает последняя запись.
 * Это осознанно повторяет поведение VS Code.
 *
 * @param file Файл-источник задач.
 * @param rawArr {@link Raw | Сырой массив определений}, извлечённый из файла-источника.
 * @returns Карта определений, ключ — `label`. */
function remapRaw(file: TC.ScopeFile, rawArr: Raw[]): Map<TC.TaskName, TC.TaskDefinition> {

    const resultMap: Map<TC.TaskName, TC.TaskDefinition> = new Map();

    for (const raw of rawArr) {
        // Пропускаем если не объект
        if (raw && typeof raw === 'object') {

            // Пропускаем задачи без- или с невалидным названием
            if (helpers.isName(raw.label)) {

                const group = typeof raw.group === 'string'
                    ? { kind: capitalizeKind(raw.group) as TC.Group, isDefault: false }
                    : raw.group?.kind
                        ? { kind: capitalizeKind(raw.group.kind) as TC.Group, isDefault: raw.group.isDefault ?? false }
                        : undefined;


                const id = helpers.buildId(file, raw.label);

                // дубликаты label'ов молча перезаписываются —
                // повторяя поведение VS Code
                resultMap.set(raw.label, {
                    hidden: raw.hide,
                    isBackground: raw.isBackground,
                    icon: {
                        id: raw.icon?.id,
                        color: raw.icon?.color
                    },
                    group,
                    id,
                });
            }
        }
    }

    return resultMap;
}


function capitalizeKind(kind: string) {
    return kind.charAt(0).toUpperCase() + kind.slice(1);
}


// #endregion Definitions


const Task = {
    fetch
};

export default Task;
