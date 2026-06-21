import type ProcessId from './ProcessId';
import type ScopeKey from '../Scope/Key';
import type TaskName from '../type.d/TaskName';

export interface Stats {
    /** Общее количество процессов у задачи */
    total: number;
    /** Количество процессов задачи в состоянии выполнения */
    running: number;
}

interface RuntimeRegistry {
    readonly getProcessId: (scopeKey: ScopeKey, taskName: TaskName) => ReadonlySet<ProcessId> | undefined;
    readonly getStats: (scopeKey: ScopeKey, taskName: TaskName) => Readonly<Stats> | undefined;
}


export default RuntimeRegistry;
