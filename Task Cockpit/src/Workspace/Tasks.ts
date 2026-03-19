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


/** Возвращает {@linkcode TC.Task | user-Task'и} ("обогащённые" vscode.Task'и), сгруппированные
 * в карты в соответствии со структурой исходных файлов задач.
 *
 * Порядок задач внутри каждой карты соответствует их порядку в исходном файле.
 *
 * Содержит только "валидные задачи": definitions без соответствующей vscode.Task
 * в результат не попадают — если VS Code отклонил definition
 * (синтаксическая ошибка, неизвестный тип, проблема провайдера),
 * такие записи — не задачи.
 *
 * @param scopes Области действия извлекаемых задач.
 *
 * @throws {vscode.CancellationError} */
async function fetch(
    scopes: ReadonlyArray<TC.Scope>,
    ctsToken: vscode.CancellationToken
): Promise<Readonly<TC.FetchResult>> {


    // Карта всех "подходящих" задач, полученных от VS Code
    const vTasksMap = new Map<TC.TaskID, vscode.Task>();

    // @note: {@linkcode vscode.fetchTasks} никогда не вернёт задачу с TaskScope.Global.
    // {@linkcode vscode.TaskScope}: "Global tasks are currently not supported."
    const fetchedTasks = await vscode.tasks.fetchTasks();

    if (ctsToken.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    // #region DEBUG
    log(LogLevel.Debug,
        `${vscode.env.appName} reports ${fetchedTasks.length} total task(s)`);
    // #endregion DEBUG

    for (const task of fetchedTasks) {

        const taskId = helpers.resolveId(task);

        if (!taskId) {

            // #region DEBUG
            log(LogLevel.Debug, `Task filtered out: name — "${task.name || '<unlabeled>'}", scope — "${task.scope ? typeof task.scope === 'number' ? 'Workspace' : task.scope.name : 'undefined'}"`);
            // #endregion DEBUG

            continue;
        }

        vTasksMap.set(taskId, task);
    }

    const definitionsByFile = new Map(
        await Promise.all(scopes.map(scope => fetchDefinitions(scope.uri, ctsToken)))
    );

    if (ctsToken.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    // #region DEBUG
    log(LogLevel.Debug,
        `Parsed ${[...definitionsByFile.values()].reduce((count, definitions) => count + definitions.size, 0)} user task definition(s) for ${definitionsByFile.size} scope(s)`);
    // #endregion DEBUG

    const tasksByFile: TC.TasksByFile = new Map();
    const rejectReport: TC.RejectReport = new Map();

    // Перебираем в порядке "из файла"
    for (const [file, definitions] of definitionsByFile) {

        const scopedTasks: TC.ScopedTasks = new Map();

        for (const [name, definition] of definitions) {

            const vTask = vTasksMap.get(definition.id);

            // Строим tasksByFile и заполняем rejectReport

            if (vTask) {
                scopedTasks.set(name, vTask);
            }
            else {
                rejectReport.set(file, (rejectReport.get(file) ?? 0) + 1);
                // #region DEBUG
                log(LogLevel.Warning, `No vscode.Task for definition — VS Code rejected or not yet loaded. Name: ${name}; File: ${file}.`);
                // #endregion DEBUG
            }
        }

        tasksByFile.set(file, scopedTasks);
    }

    return { tasksByFile, rejectReport, definitionsByFile };
}


// #region Definitions -- парсинг источника задач


/** Минимальный набор полей для представления задачи пользователю */
interface Raw {
    label?: string;
    hide?: boolean;
    icon?: TC.IconDefinition;
}


/** Кортеж из источника задач и карты определений. */
type Definitions = readonly [TC.File, Map<TC.Name, Readonly<TC.TaskDefinition>>];


/** Загрузка определений задач напрямую из файла задач.
 *
 * Парсит файл самостоятельно.
 * Гарантирует порядок задач как в файле.
 *
 * Не выбрасывает исключений. Отдаст кортеж с пустой картой при
 * любых ошибках чтения/парсинга.
 *
 * @param uri URI файла задач (не обязан существовать физически)
 * @returns кортеж из источника задач и карты определений
 *   (карта пуста при ошибках чтения/парсинга)
 *
 * @throws {vscode.CancellationError} При отмене через CancellationToken.
 *   Остальные ошибки не выбрасываются — всегда возвращается "пустой" результат.  */
async function fetchDefinitions(uri: TC.Uri, ctsToken: vscode.CancellationToken): Promise<Definitions> {

    if (ctsToken.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    try {
        const uint8Array = await vscode.workspace.fs.readFile(uri);

        if (ctsToken.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        return remapRaw(uri.fsPath, extract(
            new TextDecoder('utf-8').decode(uint8Array),
            helpers.resolveJsonPath(uri),
            // Никак не реагируем на ошибки, обслуживание файла-источника
            // задач не наша ответственность
        ));

    }
    catch (error) {

        if (error instanceof vscode.CancellationError) {
            // Пробрасываем отмену
            throw error;
        }

        // Отсутствие файла - нормальная ситуация
        // #region DEBUG
        if (error instanceof Error && 'code' in error && error.code === 'FileNotFound') {
            log(LogLevel.Trace,
                `Tasks file does not exist, skipping`,
                uri.fsPath);
        }
        else {
            // Проблемы с файлом/чтением/парсингом — не наши проблемы, VS Code разберётся
            log(LogLevel.Debug,
                `Tasks file processing error: ${error instanceof Error ? error.message : JSON.stringify(error)}, skipping`,
                uri.fsPath);
        }
        // #endregion DEBUG
        // Единственное, как реагируем: "в этой области задач нет (не нашли)"
        return [uri.fsPath, new Map()];
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

    // Извлекаем массив задач
    const raw = jsonPath.reduce((node, key) => {
        return node?.[key];
    }, parsed);
    // Не массив — не наша проблема, VS Code разберётся
    return Array.isArray(raw) ? raw : [];
}


/** Преобразует сырой json-массив в {@linkcode Definitions | кортеж определений}.
 *
 * @param file строковый URI к файлу-источнику задач
 * @param rawArr сырой массив задач
 * @returns кортеж {@linkcode Definitions}, где первый элемент — идентификатор файла,
 * второй — карта, где каждый ключ является меткой задачи из файла,
 *   а каждое значение — объектом {@linkcode TC.TaskDefinition}
 */
function remapRaw(file: TC.File, rawArr: Raw[]): Definitions {

    const map: Map<TC.Name, TC.TaskDefinition> = new Map();

    for (const raw of rawArr) {
        if (raw && typeof raw === 'object') {

            // Пропускаем задачи без или с невалидным названием
            if (helpers.isName(raw.label)) {

                // дубликаты label'ов молча перезаписываются —
                // повторяю поведение VS Code
                map.set(raw.label, {
                    id: helpers.buildId(file, raw.label),
                    hide: raw.hide,
                    icon: {
                        id: raw.icon?.id,
                        color: raw.icon?.color
                    }
                });
            }
        }
    }

    return [file, map];
}


// #endregion Definitions


const Task = {
    fetch
};

export default Task;
