import type TaskProcessId from '../TaskProcessId';
import type RequestId from '../RequestId';

interface TerminalProcessesSnapshot {
    /** Идентификатор запроса, задаваемый вызывающей стороной.
     *
     * Монотонно возрастает: каждый новый снапшот обязан иметь
     * `requestId` строго больше предыдущего (`newSnapshot.requestId > prevSnapshot.requestId`).
     * Используется для определения актуальности при конкурентных обновлениях.
     * */
    requestId: RequestId;
    /** Список процессов, реально присутствующих в системе */
    terminalProcesses: Array<TaskProcessId>;
}


export default TerminalProcessesSnapshot;
