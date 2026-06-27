import {
    type CancellationToken,
    tasks as VscTasks,
    type Disposable,
    CancellationError
} from 'vscode';
import getKey from '../Scope/getKey';
import qualifies from './qualifies';
import type EligibleTask from './EligibleTask';
import type EligibleMap from './EligibleMap';
import type ScopeKey from '../Scope/Key';
import type TaskName from '../TaskName/TaskName';


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
 * @param token Токен отмены операции.
 *
 * @returns Индекс подходящих задач, сгруппированных по {@linkcode ScopeKey}.
 *   Если для конкретного `ScopeKey` задач нет — ключ в индексе отсутствует.
 *   Вызывающий не должен рассчитывать на наличие конкретного ключа.
 *   При отмене возвращает пустой индекс.
 *
 *   При ошибке `VscTasks.fetchTasks()` возвращает пустой или частичный индекс,
 *   не бросает.
 *
 * @throws { CancellationError } */
async function fetchEligibleTasks(
    token: CancellationToken
): Promise<EligibleMap> {

    if (token.isCancellationRequested) {
        throw new CancellationError();
    }

    let disposable: Disposable | undefined;

    try {

        const fetched = await Promise.race([
            // Контракт "не бросает ничего кроме CancellationError"
            // согласуется с реальным поведением API, defensive try/catch не нужен.
            // Может "висеть" для провайдерских задач. Внутри есть таймаут 5сек.
            VscTasks.fetchTasks(),
            // не ждем если сработала отмена
            new Promise<never>(function (_resolve, reject) {
                disposable = token.onCancellationRequested(function () { reject(new CancellationError()); });
                if (token.isCancellationRequested) {
                    reject(new CancellationError());
                }
            })
        ]);

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
    finally {
        disposable?.dispose();
    }

}

export default fetchEligibleTasks;
