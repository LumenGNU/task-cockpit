import * as assert from 'assert/strict';
import Monitor from '../../../src/Runtime/Monitor';
import { dummyManufacturer } from './dummyManufacturer';
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

/** Гарантированное ожидание полного цикла polling + запас. */
const BEYOND_ONE_CYCLE = POLL_INTERVAL * 2.1;

// `${/*N=0*/'000'/**/}` 


suite('Workspace:Runtime:Monitor', function () {

    suite('Scenario P1', () => {

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


        test(`${/*++N*/'001'/**/} убитый процесс обнаруживается в пределах одного цикла polling`, async function () {

            const pid = spawner.spawn();

            const all = new Set([pid]);

            disposables.push(
                monitor.onProcessesCompleted(pids => {
                    for (const pid of pids) {
                        all.delete(pid);
                    }
                })
            );

            assert.strictEqual(monitor.getProcesses().size, 0,
                'до начала не должно быть ни одного процесса');

            monitor.addTaskProcess(pid);

            assert.strictEqual(monitor.getProcesses().size, 1,
                'после добавления должен быть один процесс');

            spawner.kill(pid);

            // Ждём дольше одного цикла — polling должен проверить и оставить
            await new Promise(r => setTimeout(r, BEYOND_ONE_CYCLE));

            assert.ok(!all.has(pid),
                `не должен содержать PID убитого процесса ${pid}`);
            assert.strictEqual(monitor.getProcesses().size, 0,
                'по завершении не должно остаться ни одного процесса');
        });


        test(`${/*++N*/'002'/**/} живой процесс остаётся в tracked после полного цикла polling`, async function () {

            const pid = spawner.spawn();

            assert.strictEqual(monitor.getProcesses().size, 0,
                'до начала не должно быть ни одного процесса');

            monitor.addTaskProcess(pid);

            // Ждём дольше одного цикла — polling должен проверить и оставить
            await new Promise(r => setTimeout(r, BEYOND_ONE_CYCLE));

            const tracked = monitor.getProcesses();

            assert.strictEqual(tracked.size, 1,
                'процесс, находящийся в активном состоянии, должен оставаться отслеживаемым после опроса');
            assert.ok(tracked.has(pid),
                `набор отслеживаемых процессов должен содержать активный PID ${pid}`);
        });


        test(`${/*++N*/'003'/**/} повторное добавление того же pid игнорируется`, function () {

            const pid = spawner.spawn();

            monitor.addTaskProcess(pid);
            assert.strictEqual(monitor.getProcesses().size, 1,
                'pre: один процесс после первого добавления');

            monitor.addTaskProcess(pid);
            monitor.addTaskProcess(pid);

            assert.strictEqual(monitor.getProcesses().size, 1,
                'добавление дубликата не должно увеличивать размер набора');
        });


        test(`${/*++N*/'004'/**/} несколько процессов живут — все обнаруживаются`, async function () {

            const pid1 = spawner.spawn();
            const pid2 = spawner.spawn();

            let fired = false;

            disposables.push(
                monitor.onProcessesCompleted(_ => {
                    fired = true;
                })
            );

            monitor.addTaskProcess(pid1);
            monitor.addTaskProcess(pid2);

            // ждем...
            await new Promise(r => setTimeout(r, BEYOND_ONE_CYCLE * 2));

            assert.equal(fired, false,
                'не должно быть сообщения о смерти процесса');

            assert.strictEqual(monitor.getProcesses().size, 2,
                'монитор следит за двумя живыми процессами');

            assert.ok(monitor.getProcesses().has(pid1),
                `набор процессов должен содержать PID ${pid1}`);
            assert.ok(monitor.getProcesses().has(pid2),
                `набор процессов должен содержать PID ${pid2}`);

        }).timeout(3_000);


        test(`${/*++N*/'005'/**/} несколько процессов умирают — все обнаруживаются`, async function () {

            const pid1 = spawner.spawn();
            const pid2 = spawner.spawn();

            const all = new Set([pid1, pid2]);

            disposables.push(
                monitor.onProcessesCompleted(pids => {
                    for (const p of pids) {
                        all.delete(p);
                    }
                })
            );

            monitor.addTaskProcess(pid1);
            monitor.addTaskProcess(pid2);

            spawner.kill(pid1);
            spawner.kill(pid2);

            await new Promise(r => setTimeout(r, BEYOND_ONE_CYCLE));

            assert.strictEqual(monitor.getProcesses().size, 0,
                'монитор уже не должен следить');
            assert.strictEqual(all.size, 0,
                'монитор должен сообщать об обоих смертях');
        });


        test(`${/*++N*/'006'/**/} не стреляют события после dispose`, async function () {

            const pid = spawner.spawn();

            let fired = false;

            disposables.push(
                monitor.onProcessesCompleted(() => {
                    fired = true;
                })
            );

            monitor.addTaskProcess(pid);
            monitor.dispose();
            spawner.kill(pid);

            // Ждём дольше polling interval: если dispose не сработал, poll обнаружит смерть
            await new Promise(r => setTimeout(r, BEYOND_ONE_CYCLE * 2));

            assert.equal(fired, false,
                'событие не должно происходить после dispose');

        }).timeout(3_000);

    });
});
