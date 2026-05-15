import * as assert from 'assert/strict';
import Monitor from '../../../src/Runtime/Monitor';
import { dummyManufacturer } from './dummyManufacturer';
import type { ProcessId } from '../../../src/type.d/ProcessId';
import * as vscode from 'vscode';


/** Polling interval для тестового Monitor (мс). */
const POLL_INTERVAL = 500;
const monitorSettings: Monitor.Settings = {
    polling: {
        min: POLL_INTERVAL,
        cap: POLL_INTERVAL * 2,
        acceleration: 0.5,
    },
};


/** Ждёт следующего {@linkcode Monitor.onProcessesCompleted}. Реджектится по таймауту. */
function awaitCompleted(monitor: Monitor, timeoutMs = 1000): Promise<ReadonlySet<ProcessId>> {
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

// `${/*N=0*/'000'/**/}` 

suite('Workspace:Runtime:Monitor', function () {

    suite('Scenario P2', () => {

        let monitor: Monitor;
        let spawner: ReturnType<typeof dummyManufacturer>;
        const disposables: vscode.Disposable[] = [];

        setup(function () {
            monitor = new Monitor(monitorSettings);
            disposables.push(monitor);
            spawner = dummyManufacturer();
        });

        teardown(function () {
            disposables.forEach(d => {
                d.dispose();
            });
            disposables.splice(0);
            spawner.killAll();
        });


        test(`${/*++N*/'001'/**/} addTaskProcess after dispose — Error: use after dispose`, function () {

            monitor.dispose();

            const pid = spawner.spawn();
            assert.throws(() => {
                monitor.addTaskProcess(pid);
            },
                { message: /use after dispose/i },
                'addTaskProcess must throw on disposed monitor'
            );
        });


        test(`${/*++N*/'002'/**/} getProcesses after dispose — Error: use after dispose`, function () {

            const pid = spawner.spawn();

            monitor.addTaskProcess(pid);
            assert.strictEqual(monitor.getProcesses().size, 1, 'precondition: process is tracked');

            monitor.dispose();

            assert.throws(
                () => monitor.getProcesses(),
                { message: /use after dispose/i },
                'getProcesses must throw on disposed monitor'
            );
        });


        test(`${/*++N*/'003'/**/} Polling поднимается заново после того как все процессы завершились`, async function () {

            // Фаза 1: добавляем и убиваем
            const pid = spawner.spawn();

            const completed1 = awaitCompleted(monitor);
            monitor.addTaskProcess(pid);
            spawner.kill(pid);
            await completed1;

            assert.strictEqual(monitor.getProcesses().size, 0, 'precondition: monitoring idle');

            // Фаза 2: новый процесс — мониторинг должен подняться
            const pid2 = spawner.spawn();

            const completed2 = awaitCompleted(monitor);
            monitor.addTaskProcess(pid2);
            spawner.kill(pid2);

            const result = await completed2;
            assert.ok(result.has(pid2), `must detect pid ${pid2} after restart`);
        });

    });

});
