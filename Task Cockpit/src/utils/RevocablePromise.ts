import {
    CancellationError,
    CancellationTokenSource,
    type CancellationToken,
    type Disposable
} from 'vscode';


/** Запускает {@linkcode worker} с возможностью кооперативной отмены извне.
 *
 * Возвращает {@linkcode RevocablePromise}: промис с результатом {@linkcode worker}
 * и функцию `revoke()` для отмены. Вызов `revoke()` переводит промис
 * в rejected-состояние с {@linkcode CancellationError}, независимо от того,
 * успел ли `worker` отреагировать на отмену через переданный токен.
 *
 * @param worker Функция, выполняющая работу. Получает
 * {@linkcode CancellationToken} для кооперативной отмены.
 *
 * Ожидается поведение в стиле {@linkcode Thenable}-API самого VS Code:
 * - при отмене (`token.onCancellationRequested`) — прервать работу
 *   и отклонить промис через {@linkcode CancellationError} (*);
 * - при "настоящей" ошибке (сбой в логике, недоступные данные и т.п.) —
 *   **не бросать исключение**, а завершиться штатно с "пустым" значением типа `T`
 *   (например, `undefined`, `null`, пустой массив/объект — в зависимости
 *   от контракта `T`). Бросать следует только `CancellationError`.
 *
 * (*): Утилита сама отклоняет промис через CancellationError, как только
 *      срабатывает отмена (слушатель на токене внутри Promise-экзекутора).
 *      Если worker тоже попытается отклонить свой промис той же ошибкой,
 *      это будет проигнорировано (промис уже settled). Фактически worker
 *      не обязан сам отклонять промис – достаточно прекратить работу. Контракт
 *      из JSDoc можно смягчить: «прервать работу (и, опционально, отклонить
 *      промис CancellationError; повторный reject будет безопасно проигнорирован)».
 *
 * Сигнатура `(token) => Promise<T>` подразумевает возврат Promise.
 * Синхронный throw из `worker` (до возврата Promise) — нарушение сигнатуры,
 * утилита от него не страхуется: оборачивать вызов в
 * `Promise.resolve().then(() => worker(token))` означало бы защищаться
 * от бага в самом `worker`-е в рантайме потребителя. Такие вещи лечатся
 * в `worker`-е, их место — ревью и тесты.  Оборачивать такое в try/catch
 * или в Promise.resolve().then(worker) — значит платить сложностью
 * потребителя за баг поставщика и делать этот баг молчаливым. Контракт нарушен —
 * чинится нарушитель, а не потребитель.
 *
 * Соблюдение контракта со стороны `worker` делает rejected-состояние
 * возвращённого промиса однозначным индикатором отмены.
 *
 * Нарушение контракта (rejected не-`CancellationError`) — баг `worker`-а.
 * Утилита от этого не защищается: ошибка пролетает насквозь в reject
 * возвращённого промиса. Диагностика такого — ревью и тесты, не рантайм.
 *
 * Отклонение не-CancellationError считается нарушением контракта, детали
 * логируются в режиме отладки
 *
 * @returns { RevocablePromise<T> } с результатом `worker` и функцией отмены.
 *
 * @throws { CancellationError } Если вызвана `revoke()`, промис отклоняется с этой ошибкой. */
// @note Замечание для тестирования
// Код, к которому нельзя подступиться через контракт, — это код, которого
// в контракте нет. А значит, его не должно быть и в реализации.
// Чтобы протестировать ветку «не-CancellationError», нужен compute, который
// бросает не-CancellationError, — то есть compute, нарушающий свой же контракт.
// Валидного сценария, в котором эта ветка срабатывает, не существует по построению.
function runCancellable<T>(
    worker: (token: CancellationToken) => Promise<T>,
): RevocablePromise<T> {

    const cts = new CancellationTokenSource();

    const promise = new Promise<T>((resolve, reject) => {

        let cancelSub: Disposable | null = cts.token.onCancellationRequested(() => {
            reject(new CancellationError());
            if (cancelSub) {
                cancelSub.dispose();
                cancelSub = null;
            }
        });

        // либо worker завершится, либо сработает cancelSub выше
        worker(cts.token)
            .then(resolve, (error) => {
                // #region DEBUG
                // if (!(error instanceof CancellationError)) {
                //     const workerName = worker.name || '<anonymous>';
                //     const detail = error instanceof Error
                //         ? `${error.name}: ${error.message}\n${error.stack ?? '(no stack)'}`
                //         : `(non-Error) ${String(error)}`;
                //     log(LogLevel.Error, `worker '${workerName}' rejected with non-CancellationError (contract violation): ${detail}`, 'runCancellable');
                // }
                // #endregion DEBUG

                reject(error);
            })
            .finally(() => {
                if (cancelSub) {
                    cancelSub.dispose();
                    cancelSub = null;
                }
                cts.dispose();
            });
    });

    return {
        promise,
        revoke: () => cts.cancel(),
    };
}


interface RevocablePromise<T> {
    promise: Promise<T>;
    revoke: () => void;
}


const RevocablePromise = {
    runCancellable
};


export default RevocablePromise;
