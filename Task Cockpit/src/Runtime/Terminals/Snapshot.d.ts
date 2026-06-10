import type ProcessId from '../ProcessId';

interface Snapshot {
    /** Идентификатор запроса, задаваемый вызывающей стороной.
     *
     * Монотонно возрастает: каждый новый снапшот обязан иметь
     * `requestId` строго больше предыдущего (`newSnapshot.requestId > prevSnapshot.requestId`).
     * Используется для определения актуальности при конкурентных обновлениях.
     * */
    requestId: number;
    /** Список процессов, реально присутствующих в системе */
    processIds: ReadonlySet<ProcessId>;
}


export default Snapshot;
