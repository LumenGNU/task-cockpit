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
 *
 * @returns Возвращает {@linkcode ProcessId} или `undefined` при таймауте/закрытии/отсутствии pid
 *
 * @throws { never } не бросает исключений, всегда возвращает результат или undefined.
 *   (`terminal.processId` не бросает. По ее контракту всегда разрешается в
 *   `number` | `undefined` или "никогда")
 *  */
async function getTerminalProcessId(
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
            // ждать.
            // Так что если терминал не отвечает за timeout — не ждем, считаем его "пустым".
            new Promise<undefined>((resolve) => {
                const timer = setTimeout(() => {
                    resolve(undefined);
                }, timeoutMs);
                disposables.push({
                    dispose() { clearTimeout(timer); }
                });
            }),
            //----------------------------------------------------------------------
            // Закрытие терминала
            // ..................
            new Promise<undefined>((resolve) => {

                window.onDidCloseTerminal((t) => {
                    if (t === terminal) { // проверяемый терминал посылает событие о закрытии...
                        resolve(undefined);
                    };
                }, undefined, disposables);

                if (terminal.exitStatus) { // ...или уже закрыт
                    resolve(undefined);
                }
            }),
            //----------------------------------------------------------------------
            // Успешный исход
            // ..............
            terminal.processId as Thenable<ProcessId | undefined>
            //----------------------------------------------------------------------
        ];

        return await Promise.race(racers);

    }
    finally {
        disposables.forEach((d) => void d.dispose());
    }
}


export default getTerminalProcessId;

// https://raw.githubusercontent.com/microsoft/vscode/refs/heads/main/src/vs/workbench/api/common/extHostTerminalService.ts
//
// конструктор:
//
// ~~~typescript
// this._pidPromise = new Promise<number | undefined>(c => this._pidPromiseComplete = c);
// ~~~
//
// executor получает только resolve (c). reject в executor не передаётся вообще — он есть вторым параметром, но здесь просто игнорируется.
// структурная гарантия: нет переменной, в которую reject был бы сохранён — значит вызвать его невозможно в принципе.
//
// Единственный способ разрешить промис — _setProcessId:
//
// ~~~typescript
// public _setProcessId(processId: number | undefined): void {
//     if (this._pidPromiseComplete) {
//         this._pidPromiseComplete(processId);       // только resolve
//         this._pidPromiseComplete = undefined;
//     } else {
//         this._pidPromise.then(pid => {
//             if (pid !== processId) {
//                 this._pidPromise = Promise.resolve(processId); // только resolve
//             }
//         });
//     }
// }
// ~~~
//
// Оба пути — resolve. reject здесь нигде нет.
//
// Итог: три возможных исхода у terminal.processId:
//
// - Резолвится в number — получили PID.
// - Резолвится в undefined — VS Code сам передал undefined через $acceptTerminalProcessId.
// - Никогда не разрешается — _setProcessId не вызывается никогда из-за сбоя на стороне основного процесса.
//
// Режекта нет ни в одном сценарии.
