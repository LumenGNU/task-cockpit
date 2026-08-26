/** @file Runtime/Terminals/collectTerminalProcessIds.ts */
/** @internal */

import {
    window
} from 'vscode';
import getTerminalProcessId from './getTerminalProcessId';

import type Immutable from '../../utils/Immutable';
import type TaskProcessId from '../TaskProcessId';
import type RequestId from '../RequestId';
import type TerminalProcessesSnapshot from './TerminalProcessesSnapshot';


/** Снапшот PID'ов, сообщённых терминалами на момент опроса.
 *
 * Наличие PID не означает, что процесс выполняет какую-либо задачу — он просто "есть".
 *
 * @param requestId Идентификатор запроса, задаваемый вызывающей стороной.
 * @param timeoutMs Максимальное время ожидания PID от каждого терминала.
 *   Передаётся в каждый вызов {@linkcode getTerminalProcessId} независимо —
 *   вся операция завершится не более чем за `timeoutMs` миллисекунд.
 *   Терминал, не ответивший за это время будет расценен как
 *   терминал без процесса.
 *
 * @returns Снапшот, содержащий только валидные PID процессов терминалов (`ProcessId`).
 *
 * @throws { never } */
async function collectTerminalProcessIds(
    requestId: RequestId,
    timeoutMs: number
): Promise<Immutable<TerminalProcessesSnapshot>> {


    const terminals = window.terminals;

    if (terminals.length === 0) {
        return { requestId, terminalProcesses: [] };
    }

    // Запускаем опрос.

    // Гарантии getProcessId:
    // - При любых проблемах возвращает `undefined`.
    // - По достижении timeout обязательно разрешится в `undefined`
    // - В остальных случаях вернет PID процесса терминала (number|undefined)
    const results = await Promise.all(terminals.map((terminal) => getTerminalProcessId(terminal, timeoutMs)));

    return {
        requestId,
        // Фильтруем закрытые/зависшие/без процесса (undefined|null)
        terminalProcesses: results.filter((p): p is TaskProcessId => p != null)
    };
}


export default collectTerminalProcessIds;
