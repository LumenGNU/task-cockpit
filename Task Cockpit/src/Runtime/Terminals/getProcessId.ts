import {
    CancellationError,
    CancellationToken,
    Terminal,
    type Disposable,
    window
} from 'vscode';
import {
    setTimeout
} from 'node:timers/promises';
import type ProcessId from '../ProcessId';

/** Надёжно получить PID терминала с поддержкой таймаута и отмены.
 *
 * Контекст:
 * `vscode.Terminal.processId` — `Thenable`, который в некоторых условиях может не завершиться.
 * Эта функция запускает "гонку" между:
 *  - успешным получением `processId`,
 *  - таймаутом,
 *  - закрытием терминала,
 *  - запросом отмены через `CancellationToken`.
 *
 * Условия возврата undefined:
 * - истёк таймаут;
 * - терминал был закрыт до получения processId;
 * - terminal.processId вернул null/undefined.
 *
 * Таким образом закрытый терминал или терминал не ответивший
 * за время `timeout` будет расценен как терминал без процесса.
 *
 * @param terminal терминал, у которого запрашивается `processId`
 * @param timeout максимальное время ожидания в миллисекундах
 * @param token `CancellationToken` для отмены операции
 * @returns Возвращает {@linkcode ProcessId} или `undefined` при таймауте/закрытии/отсутствии pid
 * @throws { CancellationError } Бросается только при отмене через token.
 *   (`terminal.processId` не бросает. По ее контракту всегда разрешается в `number` | `undefined`)
 *  */
async function getProcessId(
    terminal: Readonly<Terminal>,
    timeout: number,
    token: CancellationToken
): Promise<ProcessId | undefined> {

    if (token.isCancellationRequested) {
        throw new CancellationError();
    }

    const ac = new AbortController();
    const disposables: Disposable[] = [];

    try {

        const racers: PromiseLike<ProcessId | undefined>[] = [
            // Успешный исход
            // ..............
            terminal.processId.then(function (pid) {
                return pid ? pid as ProcessId : undefined;
            }),
            //----------------------------------------------------------------------
            // Тайм-аут
            // ........
            // Workaround для багов #91905 (2020) и #236869 (2024) и т.д.:
            // processId зависает навечно, если есть проблемы с shellIntegration,
            // провайдерами и т.д.
            // `vscode.terminal.processId` — асинхронное свойство (Thenable). Возвращает обещание
            // "ничего не обещать".
            // Нельзя отменить — можно только выбросить когда надоест
            // ждать. (Возможно есть внутренний таймаут (точно есть), но он
            // слишком долгий — десятки секунд).
            // Так что если терминал не отвечает за timeout — не ждем, считаем его "пустым".
            setTimeout<undefined>(timeout, undefined, { signal: ac.signal, ref: false }),
            //----------------------------------------------------------------------
            // Закрытие терминала
            // ..................
            new Promise<undefined>(function (resolve) {
                disposables.push(window.onDidCloseTerminal(function (t) {
                    if (t === terminal) { // проверяемый терминал посылает событие о закрытии...
                        resolve(undefined);
                    };
                }));
                if (terminal.exitStatus) { // ...или уже закрыт
                    resolve(undefined);
                }
            }),
            //----------------------------------------------------------------------
            // токен отмены
            // ............
            new Promise<never>(function (_, reject) {
                disposables.push(
                    token.onCancellationRequested(function () { // запрос отменяется...
                        reject(new CancellationError());
                    }));
                if (token.isCancellationRequested) { // ...или уже отменен
                    reject(new CancellationError());
                }
            })

        ];

        return await Promise.race(racers);

    }
    finally {
        ac.abort();
        disposables.forEach(function (disposable) {
            disposable.dispose();
        });
    }
}


export default getProcessId;
