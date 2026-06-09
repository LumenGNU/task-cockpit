import type ProcessId from '../ProcessId';

interface Snapshot {
    /** Идентификатор запроса, задаваемый вызывающей стороной */
    requestId: number;
    /** Список процессов, реально присутствующих в системе */
    processIds: ReadonlySet<ProcessId>;
}


export default Snapshot;
