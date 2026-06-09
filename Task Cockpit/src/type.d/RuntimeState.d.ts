import type { ProcessId } from '../Runtime/ProcessId';
import type { ProcessInfo } from './ProcessInfo';

/** Детализация состояния процессов задачи. */
export type RuntimeState = ReadonlyMap<ProcessId, Readonly<ProcessInfo>>;
