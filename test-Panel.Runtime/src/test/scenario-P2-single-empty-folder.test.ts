import * as assert from 'assert';
import { spawn, type ChildProcess } from 'child_process';
import Monitor from '../Runtime/Monitor';
import type { ProcessId } from '../types';


/** Polling interval для тестового Monitor (мс). */
const POLL_INTERVAL = 2000;


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

    suite('Scenario P2', () => {

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


        // addTaskProcess after dispose — Error: use after dispose
        test('addTaskProcess after dispose — Error: use after dispose', function () {
            const child = spawnDummy();
            children.push(child);
            const pid = child.pid as ProcessId;

            monitor.dispose();

            assert.throws(
                () => monitor.addTaskProcess(pid),
                { message: /use after dispose/i },
                'addTaskProcess must throw on disposed monitor'
            );
        });


        // getProcesses after dispose — Error: use after dispose
        test('getProcesses after dispose — Error: use after dispose', function () {
            const child = spawnDummy();
            children.push(child);
            const pid = child.pid as ProcessId;

            monitor.addTaskProcess(pid);
            assert.strictEqual(monitor.getProcesses().size, 1, 'precondition: process is tracked');

            monitor.dispose();

            assert.throws(
                () => monitor.getProcesses(),
                { message: /use after dispose/i },
                'getProcesses must throw on disposed monitor'
            );
        });


        // Polling поднимается заново после того как все процессы завершились
        test('monitoring restarts after all processes complete', async function () {
            // Фаза 1: добавляем и убиваем
            const child1 = spawnDummy();
            children.push(child1);
            const pid1 = child1.pid as ProcessId;

            const completed1 = awaitCompleted(monitor);
            monitor.addTaskProcess(pid1);
            child1.kill();
            await completed1;

            assert.strictEqual(monitor.getProcesses().size, 0, 'precondition: monitoring idle');

            // Фаза 2: новый процесс — мониторинг должен подняться
            const child2 = spawnDummy();
            children.push(child2);
            const pid2 = child2.pid as ProcessId;

            const completed2 = awaitCompleted(monitor);
            monitor.addTaskProcess(pid2);
            child2.kill();

            const result = await completed2;
            assert.ok(result.has(pid2), `must detect pid ${pid2} after restart`);
        });

    });

});