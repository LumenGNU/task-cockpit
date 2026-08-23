import assert from 'node:assert/strict';
import getTerminalProcessId from '../../../../src/Runtime/Terminals/getTerminalProcessId';
import * as vsc from 'vscode';
import type TaskProcessId from '../../../../src/Runtime/TaskProcessId';
import * as os from 'node:os';
import * as path from 'node:path';

const invalidCwd = path.join(
    os.tmpdir(),
    `get-terminal-process-id-test-${process.pid}-${Date.now()}`
);

async function run_task_and_wait(taskName: string, timeout: number): Promise<number | undefined> {

    const tasks = (await vsc.tasks.fetchTasks()).
        reduce(function (map, task) {
            return map.set(task.name, task);
        }, new Map<string, vsc.Task>());

    if (!tasks.has(taskName)) {
        throw new Error(`Задача "${taskName}" не определена в этом окружении`);
    }

    // --------------------------------------------------------------------

    let timer: NodeJS.Timeout | undefined;
    let disp: vsc.Disposable | undefined;

    // --------------------------------------------------------------------
    try {

        const pendingPid = new Promise<number>((resolve, reject) => {

            timer = setTimeout(() => {
                reject(new Error(`onDidStartTaskProcess не сработало за ${timeout}ms`));
            }, timeout);

            disp = vsc.tasks.onDidStartTaskProcess(e => {

                if (e.execution.task.name !== taskName) {
                    reject(new Error(`ожидаем эксклюзивно задачу "${taskName}", но стартовала "${e.execution.task.name}"`));
                    return;
                }

                resolve(e.processId);
            });
        });

        await vsc.tasks.executeTask(tasks.get(taskName)!);
        return await pendingPid;
    }
    catch (error) {
        throw new Error(`Не удалось запустить задачу ${taskName}`, { cause: error });
    }
    finally { // уборка
        if (timer) {
            clearTimeout(timer);
        }
        if (disp) {
            disp.dispose();
        }
    }
}


async function dispose_and_wait(terminal: vsc.Terminal, timeout: number): Promise<void> {

    let timer: NodeJS.Timeout | undefined;
    let disp: vsc.Disposable | undefined;

    try {
        const promise = new Promise<void>((resolve, reject) => {

            disp = vsc.window.onDidCloseTerminal(function (t) {
                if (t === terminal) {
                    resolve();
                }
            });

            if (terminal.exitStatus) {
                resolve();
            }

            timer = setTimeout(function () {
                reject(new Error(`Терминал не закрыт за ${timeout}ms`));
            }, timeout);

        });

        terminal.dispose();

        return await promise;
    }
    finally {
        if (timer) {
            clearTimeout(timer);
        }
        disp?.dispose();
    }
}


// `${/*N=0*/'000'/**/}`

suite('getTerminalProcessId', function () {

    let tasks: Map<string, vsc.Task>;
    let cancellationTokenSource: vsc.CancellationTokenSource | undefined;

    suiteSetup(async function () {

        tasks = (await vsc.tasks.fetchTasks()).
            reduce(function (map, task) {
                return map.set(task.name, task);
            }, new Map<string, vsc.Task>());


        // Сценарий задачи:
        // - Порождает новый терминал
        // - Запускает шел-процесс
        // - Выполняется вечно
        // - Не закрывает терминал самостоятельно
        assert.ok(tasks.get('task-1'));

        // Копии 'task-1'
        // для сценариев с несколькими терминалами.
        // Можно многократно запускать 'task-1', но вывод будет
        // завален сообщениями "Unexpected: The specified task is missing an execution"
        assert.ok(tasks.get('task-1.1'));
        assert.ok(tasks.get('task-1.2'));
        assert.ok(tasks.get('task-1.3'));

    });

    setup(async function () {

        for (const terminal of vsc.window.terminals) {
            await dispose_and_wait(terminal, 1_000);
        }

        assert.equal(vsc.window.terminals.length, 0);

        // -----

        cancellationTokenSource = new vsc.CancellationTokenSource();
    });

    teardown(function () {

        cancellationTokenSource?.dispose();
    });


    suite('Успешное получение PID', function () {

        test(`${/*++N*/'001'/**/} возвращает PID живого терминала`, async function () {

            const timeout = 3_000;
            this.timeout(timeout + 100);

            // --------------------------------------------------------------------

            // запускаем задачу, ждем пид задачи от vsc
            const PID = await run_task_and_wait('task-1', timeout);

            assert.equal(vsc.window.terminals.length, 1, `ожидается что открыт ровно один терминал, но открыто ${vsc.window.terminals.length}`);
            const terminal = vsc.window.terminals.at(0)!;
            assert.ok(terminal);

            const result = await getTerminalProcessId(terminal, timeout);
            assert.ok(result);
            assert.equal(result, PID, `PID’ы от getTerminalProcessId и vsc должны совпадать: ${result} ≠ ${PID}`);
        });

        test(`${/*++N*/'002'/**/} несколько терминалов — у каждого свой PID`, async function () {

            const timeout = 3_000;
            this.timeout(timeout + 100);

            const TASK_NAMES = [
                'task-1.1',
                'task-1.2',
                'task-1.3'
            ];

            // --------------------------------------------------------------------

            // запускаем задачу три раза, ждем pid’ы задач от vsc.
            // Последовательно! нельзя Promise.all
            const PIDS = [];
            for (const taskName of TASK_NAMES) {
                PIDS.push(await run_task_and_wait(taskName, timeout));
            }

            assert.equal(vsc.window.terminals.length, PIDS.length, `ожидается что открыт ровно ${PIDS.length} терминала, но открыто ${vsc.window.terminals.length}`);

            const results = await Promise.all(
                vsc.window.terminals.map(function (terminal) {
                    return getTerminalProcessId(terminal, timeout);
                })
            );

            assert.equal(results.length, PIDS.length);
            assert.deepEqual(results.sort(), PIDS.sort(), 'PID’ы от getTerminalProcessId и vsc должны совпадать');
        });

    });

    suite('Закрытие терминала', function () {

        test(`${/*++N*/'003'/**/} терминал уже закрыт до вызова — undefined`, async function () {
            const timeout = 3_000;
            this.timeout(timeout + 1000);

            // --------------------------------------------------------------------

            // запускаем задачу, ждем пид задачи от vsc
            const PID = await run_task_and_wait('task-1', timeout);

            assert.ok(PID, 'PID должен быть');
            assert.equal(vsc.window.terminals.length, 1, `ожидается что открыт ровно один терминал, но открыто ${vsc.window.terminals.length}`);

            // держим и закрываем
            const terminal = vsc.window.terminals.at(0);
            assert.ok(terminal);
            await dispose_and_wait(terminal, 1_000);

            const result = await getTerminalProcessId(terminal, timeout);
            assert.equal(result, undefined, `для закрытого терминала должно быть undefined, но получено ${typeof result}`);

        });

        test(`${/*++N*/'004'/**/} dispose терминала во время ожидания — undefined`, async function () {

            const timeout = 3_000;
            this.timeout(timeout + 1000);

            let isResolved = false;
            let timer: NodeJS.Timeout | null = null;

            // Создаём нормальный терминал
            const terminal = vsc.window.createTerminal({ name: 'test-close-during' });
            // Подменяем processId на медленный
            const slowProcessId = new Promise<number>((resolve) => {
                timer = setTimeout(function () {
                    isResolved = true;
                    resolve(123456789);
                }, 2_500);
            });
            Object.defineProperty(terminal, 'processId', {
                get: () => slowProcessId,
            });

            try {
                const promise = getTerminalProcessId(terminal, timeout);
                // освобождаем терминал через небольшую задержку
                await new Promise(resolve => setTimeout(resolve, 550));
                terminal.hide();
                terminal.dispose();

                const result = await promise;
                assert.equal(result, undefined, `ожидается undefined, но получен ${typeof result}`);
                assert.equal(isResolved, false, 'pid не должен успеть');

            } finally {
                if (timer) {
                    clearTimeout(timer);
                }
                // безопасно
                terminal.dispose();
            }
        });

    });

    suite('Зависания и таймауты', function () {

        // Задача: не зависнуть там, где processId повисает. Через какую ветку — дело среды, не getTerminalProcessId
        // Реальный pathological state VS Code, который и является исходной причиной существования getTerminalProcessId
        // Демонстрирует, что в реальной среде processId не разрешается в течение разумного наблюдаемого интервала,
        // а getTerminalProcessId корректно переживает это состояние.
        test(`${/*++N*/'005'/**/} не зависает при реально зависшем processId (терминал с несуществующим cwd)`, async function () {

            const timeoutMs = 3_000;
            this.timeout(timeoutMs * 3 + 1_000);

            const TASK_NAME = 'task-1';

            // --------------------------------------------------------------------

            // запускаем задачу, ждем пид задачи от vsc
            const PID = await run_task_and_wait(TASK_NAME, timeoutMs);

            // Будет открыт нормальный терминал
            assert.equal(vsc.window.terminals.length, 1, `ожидается что открыт ровно один терминал, но открыто ${vsc.window.terminals.length}`);
            const terminalNormal = vsc.window.terminals.at(0);
            assert.ok(terminalNormal);
            assert.equal(await terminalNormal.processId, PID); // не будет проблем

            // Создаем сломанный терминал
            const terminalBug = vsc.window.createTerminal({
                name: 'test-get-pid-shy',
                cwd: invalidCwd
            });

            terminalBug.show();

            try {

                let bugPidSettled: 'not-fulfilled' | unknown = 'not-fulfilled';

                // Я ожидаю, что Promise никогда не завершится.
                // Я не собираюсь ждать бесконечно; мне достаточно убедиться, что он не завершился за timeoutMs секунды.
                terminalBug.processId.then(
                    (pid) => { bugPidSettled = pid; },
                    (err) => { bugPidSettled = err; }
                );

                await new Promise<void>((r) => {
                    setTimeout(() => { r(); }, timeoutMs);
                }); // уступаем очередь

                if (bugPidSettled !== 'not-fulfilled') {
                    assert.fail(
                        `В этой среде processId terminalBug не завис: ` +
                        `promise завершился со значением ${String(bugPidSettled)}. ` +
                        `Проблема, которую решает getTerminalProcessId, не воспроизвелась.`
                    );
                }

                // Результат будет получен по достижении timeout
                // или по закрытию терминала — НЕ будет висеть вечно в отличии от processId
                const results = await Promise.all(
                    [terminalBug, terminalNormal].map(function (terminal) {
                        return getTerminalProcessId(terminal, timeoutMs);
                    })
                );

                // сработала ветка "Закрытие терминала"
                // документирует поведение среды, а не утверждение
                assert.ok(terminalBug.exitStatus != null);

                assert.equal(results.length, 2);
                assert.ok(results.includes(PID as TaskProcessId), 'ответ от нормального терминала должен присутствовать');
                assert.ok(results.includes(undefined), 'ответ от сломанного терминала должен присутствовать');

            }
            finally {
                terminalBug.dispose();
                terminalNormal.dispose();
            }

        });

        test(`${/*++N*/'006'/**/} не зависает на зависшем processId — разрешается в undefined по таймауту (синтетика)`, async function () {
            // Имитируем Thenable, который никогда не разрешается, чтобы проверить таймаут

            const timeoutMs = 3_000;
            this.timeout(timeoutMs + 1000);

            const TASK_NAME = 'task-1';

            // --------------------------------------------------------------------

            // запускаем задачу, ждем пид задачи от vsc
            const PID = await run_task_and_wait(TASK_NAME, timeoutMs);

            // Будет открыт нормальный терминал
            assert.equal(vsc.window.terminals.length, 1, `ожидается что открыт ровно один терминал, но открыто ${vsc.window.terminals.length}`);
            const terminalNormal = vsc.window.terminals.at(0);
            assert.ok(terminalNormal);
            assert.equal(await terminalNormal.processId, PID); // не будет проблем

            // Создаем сломанный терминал (создаем, а потом ломаем)
            // Синтетика, но какое-нибудь my-super-extension-yan2007 такой терминал уже реализовало :)
            const terminalBug = vsc.window.createTerminal({
                name: 'test-get-pid-bug'
            });
            Object.defineProperty(terminalBug, 'processId', { get: () => new Promise(() => { /* never resolves */; }) });

            terminalBug.show();

            try {

                let bugPidResolved = false;

                // Будет висеть вечно
                terminalBug.processId.then(function () {
                    bugPidResolved = true;
                });

                await Promise.resolve(); // уступаем очередь
                assert.equal(bugPidResolved, false, 'processId зависшего терминала не должен был разрешится');

                // Результат будет получен по достижении timeout
                // НЕ будет висеть вечно
                const results = await Promise.all(
                    [terminalBug, terminalNormal].map(function (terminal) {
                        return getTerminalProcessId(terminal, timeoutMs);
                    })
                );

                // НЕ сработала ветка "Закрытие терминала"
                // документирует поведение среды, а не утверждение
                assert.ok(terminalBug.exitStatus === undefined);

                assert.equal(bugPidResolved, false, 'processId зависшего терминала не должен был разрешится');

                assert.equal(results.length, 2);
                assert.ok(results.includes(PID as TaskProcessId), 'ответ от нормального терминала должен присутствовать');
                assert.ok(results.includes(undefined), 'ответ от сломанного терминала должен присутствовать');

            }
            finally {
                terminalBug.dispose();
                terminalNormal.dispose();
            }

        });

    });

});
