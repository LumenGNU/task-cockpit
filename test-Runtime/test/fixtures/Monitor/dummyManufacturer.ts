import { spawn, type ChildProcess } from 'child_process';
import type { ProcessId } from '../../../src/type.d/ProcessId';

export function dummyManufacturer() {

    const childrenMap = new Map<ProcessId, ChildProcess>();

    return {

        spawn(): ProcessId {
            const proc = spawn(process.execPath, ['-e', 'setTimeout(()=>{},60000)'], {
                stdio: 'ignore',
                detached: false,
            });
            if (!proc.pid) {
                try { proc.kill(); } catch { /* ничего не поделаю */ }
                throw new Error('процесс запущен без pid');
            }
            const pid = proc.pid as ProcessId;
            childrenMap.set(pid, proc);
            return pid;
        },

        kill(pid: ProcessId) {
            const proc = childrenMap.get(pid);
            if (proc) {
                try { proc.kill('SIGKILL'); } catch { /* уже мёртв */ }
                childrenMap.delete(pid);
            }
        },

        killAll() {
            for (const proc of childrenMap.values()) {
                try { proc.kill('SIGKILL'); } catch { /* уже мёртв */ }
            }
            childrenMap.clear();
        }
    } as const;
}