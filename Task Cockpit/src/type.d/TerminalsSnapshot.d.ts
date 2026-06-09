import { ProcessId } from '../Runtime/ProcessId';

/** Снимок состояния открытых терминалов в момент времени. */
export interface TerminalsSnapshot {
    timestamp: number,
    processIds: ReadonlySet<ProcessId>;
}
