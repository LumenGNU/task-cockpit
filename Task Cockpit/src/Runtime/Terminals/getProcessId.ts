import {
    Terminal,
    type Disposable,
    window
} from 'vscode';
import type ProcessId from '../ProcessId';

/** Надёжно получить PID терминала с поддержкой таймаута.
 *
 * Контекст:
 * `vscode.Terminal.processId` — `Thenable`, который в некоторых условиях может не завершиться.
 * Эта функция запускает "гонку" между:
 *  - успешным получением `processId`,
 *  - таймаутом,
 *  - закрытием терминала,
 *
 * Условия возврата undefined:
 * - истёк таймаут;
 * - терминал был закрыт до получения processId;
 * - terminal.processId вернул 0/null/undefined.
 *
 * Таким образом закрытый терминал или терминал не ответивший
 * за время `timeout` будет расценен как терминал без процесса.
 *
 * @param terminal терминал, у которого запрашивается `processId`
 * @param timeoutMs максимальное время ожидания в миллисекундах. Если
 *   терминал не вернул PID за это время терминал считается
 *   терминалом без процесса.
 * @returns Возвращает {@linkcode ProcessId} или `undefined` при таймауте/закрытии/отсутствии pid
 * @throws { never } не бросает исключений, всегда возвращает результат или undefined.
 *   (`terminal.processId` не бросает. По ее контракту всегда разрешается в
 *   `number` | `undefined` или "никогда")
 *  */
async function getProcessId(
    terminal: Readonly<Terminal>,
    timeoutMs: number
): Promise<ProcessId | undefined> {


    const disposables: Disposable[] = [];

    try {

        const racers: PromiseLike<ProcessId | undefined>[] = [
            // Тайм-аут
            // ........
            // Workaround для багов #91905 (2020) и #236869 (2024) и т.д.:
            // processId зависает навечно, если есть проблемы с shellIntegration,
            // провайдерами и т.д.
            // `vscode.terminal.processId` — асинхронное свойство (Thenable). Возвращает обещание
            // "ничего не обещать".
            // Нельзя отменить — но можно прекратить ожидание и разрешиться в undefined когда надоест
            // ждать. (Возможно есть внутренний таймаут (точно есть - не всегда включается в работу), но он
            // слишком долгий — десятки секунд).
            // Так что если терминал не отвечает за timeout — не ждем, считаем его "пустым".
            new Promise<undefined>(function (resolve) {
                const timer = setTimeout(function () {
                    resolve(undefined);
                }, timeoutMs);
                disposables.push({
                    dispose() { clearTimeout(timer); },
                });
            }),
            //----------------------------------------------------------------------
            // Закрытие терминала
            // ..................
            new Promise<undefined>(function (resolve) {
                const listener = window.onDidCloseTerminal(function (t) {
                    if (t === terminal) { // проверяемый терминал посылает событие о закрытии...
                        resolve(undefined);
                    };
                });

                if (terminal.exitStatus) { // ...или уже закрыт
                    resolve(undefined);
                }

                disposables.push(listener);
            }),
            //----------------------------------------------------------------------
            // Успешный исход
            // ..............
            terminal.processId.then((pid) => {
                return pid ? pid as ProcessId : undefined;
            }),
            //----------------------------------------------------------------------
        ];

        return await Promise.race(racers);

    }
    finally {
        disposables.forEach(function (disposable) {
            disposable.dispose();
        });
    }
}


export default getProcessId;
