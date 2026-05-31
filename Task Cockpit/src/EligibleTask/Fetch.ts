/** @file EligibleTask/Fetch.ts */
/** @module Fetch */


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


import {
    type CancellationToken,
    tasks as VscTasks,
    env
} from 'vscode';
import EligibleTask from '.';
import type TaskId from '../type.d/TaskId';


/** Строит индекс "подходящих" задач из списка, полученного
 * от VS Code.
 *
 * "Подходящими" считаются задачи, прошедшие проверку
 * {@linkcode EligibleTask.qualifies}.
 *
 * @note Константа {@linkcode TaskScope.Global} в API присутствует,
 *   но задач с такой областью не встречается — глобальные задачи
 *   приходят с областью `Workspace` и от остальных отличаются
 *   внутри {@linkcode EligibleTask.Id.from}.
 *
 * @param ctsToken Токен отмены.
 * @returns Индекс подходящих задач по ID. Отсутствие конкретного ID —
 *   нормальная ситуация, вызывающий не должен ожидать конкретный ID в индексе.
 *
 * @noThrows.
 *   **Важно**: По контракту — не бросает ничего, при отмене возвращает пустой индекс.
 *              При любых проблемах возвращает пустой/частичный индекс. */
async function fetch(
    ctsToken: CancellationToken
): Promise<
    Readonly<
        Record<TaskId, Readonly<EligibleTask>>
    >
> {

    // Индекс всех "подходящих" задач, полученных от VS Code
    const index = Object.create(null) as Record<TaskId, EligibleTask>;

    if (ctsToken.isCancellationRequested) {
        return index;
    }

    // Контракт "не бросает ничего кроме CancellationError"
    // согласуется с реальным поведением API, defensive try/catch не нужен.
    // Может "висеть" для провайдерских задач, есть таймаут 5сек.
    const fetchedTasks = await VscTasks.fetchTasks();

    if (ctsToken.isCancellationRequested) {
        return index;
    }

    // Отобрать "подходящие" задачи и проиндексировать по ID,
    // пропуская "не подходящие"
    for (const task of fetchedTasks) {

        if (!EligibleTask.qualifies(task)) {
            // id не создается для "не подходящих" задач
            // #region DEBUG
            const scopeLabel =
                task.scope === undefined
                    ? 'undefined'
                    : typeof
                        task.scope === 'number'
                        ? 'Workspace'
                        : task.scope.name;
            log(LogLevel.Trace, `Task filtered out: Name="${task.name || '<unlabeled>'}"; Scope="${scopeLabel}"`, 'fetchTaskIndex');
            // #endregion DEBUG

            continue;
        }

        const taskId = EligibleTask.Id.from(task);

        index[taskId] = task;
    }

    // #region DEBUG
    // @note пропускай этот кусок в ревю
    const total = fetchedTasks.length;
    log(LogLevel.Debug, `${env.appName} reports ${total} total task(s)`);
    let indexed = 0;
    let _;
    for (_ in index) { ++indexed; }
    const filteredOut = total - indexed;
    log(LogLevel.Debug, `Cockpit indexed ${indexed} task(s)${filteredOut > 0 ? `; ${filteredOut} filtered out` : ''}`, 'fetchTaskIndex');
    // #endregion DEBUG

    return index;
}


export default fetch;
