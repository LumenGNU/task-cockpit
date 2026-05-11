import * as assert from 'assert';
import { spawn, type ChildProcess } from 'child_process';
import Monitor from '../Runtime/Monitor';
import type { ProcessId } from '../types';


/** Polling interval для тестового Monitor (мс). */
const POLL_INTERVAL = 2000;

/** Гарантированное ожидание полного цикла polling + запас. */
const BEYOND_ONE_CYCLE = POLL_INTERVAL + 800;


function spawnDummy(): ChildProcess {
    return spawn(process.execPath, ['-e', 'setTimeout(()=>{},60000)'], {
        stdio: 'ignore',
        detached: false,
    });
}

/** Ждёт следующего {@linkcode Monitor.onProcessesCompleted}. Реджектится по таймауту. */
function awaitCompleted(monitor: Monitor, timeoutMs = 3000): Promise<ReadonlySet<ProcessId>> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error('onProcessesCompleted did not fire within timeout')),
            timeoutMs);
        const sub = monitor.onProcessesCompleted(pids => {
            clearTimeout(timer);
            sub.dispose();
            resolve(pids);
        });
    });
}


suite('@module MainPanel.Runtime:Monitor', function () {

    suite('Scenario P1', () => {

        let monitor: Monitor;
        const children: ChildProcess[] = [];

        setup(function () {
            monitor = new Monitor(POLL_INTERVAL);
        });

        teardown(function () {
            monitor.dispose();
            for (const child of children) {
                try { child.kill(); } catch { /* уже мёртв */ }
            }
            children.length = 0;
        });


        // Убитый процесс обнаруживается в пределах одного цикла polling
        test('dead process detected within one polling cycle', async function () {
            const child = spawnDummy();
            children.push(child);
            assert.ok(child.pid, 'child must have a pid');

            const pid = child.pid as ProcessId;
            const completed = awaitCompleted(monitor);

            monitor.addTaskProcess(pid);
            child.kill();

            const result = await completed;
            assert.ok(result.has(pid), `completed set must contain killed pid ${pid}`);
            assert.strictEqual(monitor.getProcesses().size, 0, 'no processes should remain after completion');
        });


        // Живой процесс остаётся в tracked после полного цикла polling
        test('alive process survives polling cycle', async function () {
            const child = spawnDummy();
            children.push(child);
            const pid = child.pid as ProcessId;

            monitor.addTaskProcess(pid);

            // Ждём дольше одного цикла — polling должен проверить и оставить
            await new Promise(r => setTimeout(r, BEYOND_ONE_CYCLE));

            const tracked = monitor.getProcesses();
            assert.strictEqual(tracked.size, 1, 'alive process must remain tracked after polling');
            assert.ok(tracked.has(pid), `tracked set must contain alive pid ${pid}`);
        });


        // Повторное добавление того же pid игнорируется
        test('duplicate pid is ignored', function () {
            const child = spawnDummy();
            children.push(child);
            const pid = child.pid as ProcessId;

            monitor.addTaskProcess(pid);
            assert.strictEqual(monitor.getProcesses().size, 1,
                'Precondition: one process after first add');

            monitor.addTaskProcess(pid);
            assert.strictEqual(monitor.getProcesses().size, 1, 'duplicate add must not increase set size');
        });


        // Процесс, убитый ДО addTaskProcess, обнаруживается на первом цикле
        test('already-dead pid detected on first cycle', async function () {
            const child = spawnDummy();
            children.push(child);
            const pid = child.pid as ProcessId;
            child.kill();

            const completed = awaitCompleted(monitor);
            monitor.addTaskProcess(pid);

            const result = await completed;
            assert.ok(result.has(pid), `must detect already-dead pid ${pid}`);
        });


        // Несколько процессов умирают одновременно — все обнаруживаются
        test('batch detection — multiple processes die simultaneously', async function () {
            const child1 = spawnDummy();
            const child2 = spawnDummy();
            children.push(child1, child2);
            const pid1 = child1.pid as ProcessId;
            const pid2 = child2.pid as ProcessId;

            const allCompleted = new Set<ProcessId>();
            const bothDetected = new Promise<void>((resolve, reject) => {
                const timer = setTimeout(
                    () => reject(new Error(`only detected [${[...allCompleted]}], expected both ${pid1} and ${pid2}`)),
                    5000);
                monitor.onProcessesCompleted(pids => {
                    for (const p of pids) allCompleted.add(p);
                    if (allCompleted.has(pid1) && allCompleted.has(pid2)) {
                        clearTimeout(timer);
                        resolve();
                    }
                });
            });

            monitor.addTaskProcess(pid1);
            monitor.addTaskProcess(pid2);

            child1.kill();
            child2.kill();

            await bothDetected;
            assert.strictEqual(monitor.getProcesses().size, 0, 'no processes should remain');
        });


        // После dispose события не стреляют — ждём полный цикл для надёжности
        test('dispose stops monitoring — no events after dispose', async function () {
            const child = spawnDummy();
            children.push(child);
            const pid = child.pid as ProcessId;

            let fired = false;
            monitor.onProcessesCompleted(() => { fired = true; });

            monitor.addTaskProcess(pid);
            monitor.dispose();
            child.kill();

            // Ждём дольше polling interval: если dispose не сработал, poll обнаружит смерть
            await new Promise(r => setTimeout(r, BEYOND_ONE_CYCLE));
            assert.strictEqual(fired, false, 'event must not fire after dispose');
        });

    });
});