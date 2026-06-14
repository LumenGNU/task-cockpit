import {
    type CancellationToken,
    tasks as VscTasks,
    type Disposable
} from 'vscode';
import getKey from '../Scope/getKey';
import qualifies from './qualifies';
import type EligibleTask from './EligibleTask';
import type EligibleMap from './EligibleMap';
import type ScopeKey from '../Scope/Key';
import type TaskName from '../type.d/TaskName';


/** Строит индекс "подходящих" задач из списка, полученного
 * от VS Code.
 *
 * "Подходящими" считаются задачи, прошедшие проверку
 * {@linkcode qualifies}.
 *
 * @remarks
 * `TaskScope.Global` в API присутствует, но задач с такой областью
 *  на практике не встречается — глобальные задачи приходят с областью
 * `Workspace` и от остальных не отличаются.
 *
 * @param ct Токен отмены операции.
 *
 * @returns Индекс подходящих задач, сгруппированных по {@linkcode ScopeKey}.
 *   Если для конкретного `ScopeKey` задач нет — ключ в индексе отсутствует.
 *   Вызывающий не должен рассчитывать на наличие конкретного ключа.
 *   При отмене возвращает пустой индекс.
 *   При ошибке возвращает пустой или частичный индекс (определяется
 *   поведением `VscTasks.fetchTasks()`).
 *
 * @throws { never } Исключений не бросает — при отмене возвращает пустой индекс.
 *   Поведение при ошибках определяется контрактом {@linkcode VscTasks.fetchTasks}. */
async function fetch(
    ct: CancellationToken
): Promise<
    EligibleMap
> {

    if (ct.isCancellationRequested) {
        return new Map();
    }

    let cancelDisposable: Disposable | undefined;

    const fetched = await Promise.race([
        // Контракт "не бросает ничего кроме CancellationError"
        // согласуется с реальным поведением API, defensive try/catch не нужен.
        // Может "висеть" для провайдерских задач. Внутри есть таймаут 5сек.
        VscTasks.fetchTasks(),
        // не ждем если сработала отмена — возвращаем null
        new Promise<null>(resolve => {
            cancelDisposable = ct.onCancellationRequested(function () { resolve(null); });
        })
    ]);

    void cancelDisposable?.dispose();

    if (fetched == null) {
        // пустая карта при отмене
        return new Map();
    }

    return fetched.reduce(function (map, task) {
        if (qualifies(task)) {
            // Отобрать "подходящие" задачи и проиндексировать по
            // идентификаторам (ScopeKey, TaskName),
            // пропуская "не подходящие"

            const scopeKey = getKey(task.scope);

            let taskMap = map.get(scopeKey);
            if (taskMap === undefined) {
                taskMap = new Map();
                map.set(scopeKey, taskMap);
            }
            taskMap.set(task.name, task);
        }
        // else {
        //     // @todo log
        // }
        return map;
    }, new Map<ScopeKey, Map<TaskName, EligibleTask>>());

}

export default fetch;
