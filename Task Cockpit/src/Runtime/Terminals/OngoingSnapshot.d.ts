import type ProcessId from '../ProcessId';
import type RequestId from '../RequestId';

interface OngoingSnapshot {
    /** Идентификатор запроса, задаваемый вызывающей стороной.
     *
     * Монотонно возрастает: каждый новый снапшот обязан иметь
     * `requestId` строго больше предыдущего (`newSnapshot.requestId > prevSnapshot.requestId`).
     * Используется для определения актуальности при конкурентных обновлениях.
     * */
    requestId: RequestId;
    /** Список процессов, реально присутствующих в системе */
    ongoingProcesses: Set<ProcessId>;
}


export default OngoingSnapshot;
