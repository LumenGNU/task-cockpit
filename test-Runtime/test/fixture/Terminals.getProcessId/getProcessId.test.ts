import assert from 'node:assert/strict';
import type ProcessId from 'src/Runtime/ProcessId';
import getProcessId from 'src/Runtime/Terminals/getProcessId';
import * as vsc from 'vscode';


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

suite('getProcessId', function () {

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
        assert.ok(tasks.get('scenario-1'));

        // Копии 'scenario-1'
        // для сценариев с несколькими терминалами.
        // Можно многократно запускать 'scenario-1', но вывод будет
        // завален сообщениями "Unexpected: The specified task is missing an execution"
        assert.ok(tasks.get('scenario-1.1'));
        assert.ok(tasks.get('scenario-1.2'));
        assert.ok(tasks.get('scenario-1.3'));

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

            const TASK_NAME = 'scenario-1';

            // --------------------------------------------------------------------

            // запускаем задачу, ждем пид задачи от vsc
            const PID = await run_task_and_wait(TASK_NAME, timeout);

            assert.equal(vsc.window.terminals.length, 1, `ожидается что открыт ровно один терминал, но открыто ${vsc.window.terminals.length}`);
            const terminal = vsc.window.terminals.at(0)!;
            assert.ok(terminal);

            const result = await getProcessId(terminal, timeout, cancellationTokenSource!.token);
            assert.ok(result);
            assert.equal(result, PID, `PID’ы от getProcessId и vsc должны совпадать: ${result} ≠ ${PID}`);
        });

        test(`${/*++N*/'002'/**/} несколько терминалов — у каждого свой PID`, async function () {

            const timeout = 3_000;
            this.timeout(timeout + 100);

            const TASK_NAMES = [
                'scenario-1.1',
                'scenario-1.2',
                'scenario-1.3'
            ];

            // --------------------------------------------------------------------

            // запускаем задачу три раза, ждем pid’ы задач от vsc.
            // Последовательно! нельзя Promise.all
            const PIDS = [];
            for (const taskName of TASK_NAMES) {
                PIDS.push(await run_task_and_wait(taskName, timeout));
            }

            assert.equal(vsc.window.terminals.length, PIDS.length, `ожидается что открыт ровно ${PIDS.length} терминала, но открыто ${vsc.window.terminals.length}`);

            const token = cancellationTokenSource!.token;
            const results = await Promise.all(
                vsc.window.terminals.map(function (terminal) {
                    return getProcessId(terminal, timeout, token);
                })
            );

            assert.equal(results.length, PIDS.length);
            assert.deepEqual(results.sort(), PIDS.sort(), 'PID’ы от getProcessId и vsc должны совпадать');
        });

    });

    suite('Закрытие терминала', function () {

        test(`${/*++N*/'003'/**/} терминал уже закрыт до вызова — undefined`, async function () {
            const timeout = 3_000;
            this.timeout(timeout + 1000);

            const TASK_NAME = 'scenario-1';

            // --------------------------------------------------------------------

            // запускаем задачу, ждем пид задачи от vsc
            const PID = await run_task_and_wait(TASK_NAME, timeout);

            assert.ok(PID, 'PID должен быть');
            assert.equal(vsc.window.terminals.length, 1, `ожидается что открыт ровно один терминал, но открыто ${vsc.window.terminals.length}`);

            // держим и закрываем
            const terminal = vsc.window.terminals.at(0);
            assert.ok(terminal);
            await dispose_and_wait(terminal, 1_000);

            const result = await getProcessId(terminal, timeout, cancellationTokenSource!.token);
            assert.equal(result, undefined, `для закрытого терминала должно быть undefined, но получено ${typeof result}`);

        });

        test(`${/*++N*/'004'/**/} dispose терминала во время ожидания — undefined`, async function () {

            const timeout = 3_000;
            this.timeout(timeout + 1000);

            let isResolved = false;
            let timer: NodeJS.Timeout | null = null;

            // Создаём нормальный терминал
            const terminal = vsc.window.createTerminal({ name: 'test-close-during' });
            // Подменяем processId на меееееедленный
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
                const promise = getProcessId(terminal, timeout, cancellationTokenSource!.token);
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

        // Задача: не зависнуть там, где processId повисает. Через какую ветку — дело среды, не getProcessId
        test(`${/*++N*/'005'/**/} зависший терминал — разрешается в undefined, не висит`, async function () {

            const timeout = 3_000;
            this.timeout(timeout + 1000);

            const TASK_NAME = 'scenario-1';

            // --------------------------------------------------------------------

            // запускаем задачу, ждем пид задачи от vsc
            const PID = await run_task_and_wait(TASK_NAME, timeout);

            // Будет открыт нормальный терминал
            assert.equal(vsc.window.terminals.length, 1, `ожидается что открыт ровно один терминал, но открыто ${vsc.window.terminals.length}`);
            const terminalNormal = vsc.window.terminals.at(0);
            assert.ok(terminalNormal);
            assert.equal(await terminalNormal.processId, PID); // не будет проблем

            // Создаем сломанный терминал
            const terminalBug = vsc.window.createTerminal({
                name: 'test-get-pid-shy',
                cwd: '/does/not/exist'
            });

            terminalBug.show();

            try {

                let bugPidResolved = false;

                // Будет висеть вечно
                terminalBug.processId.then(function () {
                    bugPidResolved = true;
                });

                await Promise.resolve(); // уступаем очередь
                assert.equal(bugPidResolved, false, 'processId зависшего терминала не должен был разрешится');

                const token = cancellationTokenSource!.token;
                // Результат будет получен по достижении timeout
                // или по закрытию терминала — НЕ будет висеть вечно
                const results = await Promise.all(
                    [terminalBug, terminalNormal].map(function (terminal) {
                        return getProcessId(terminal, timeout, token);
                    })
                );

                // сработала ветка "Закрытие терминала"
                // документирует поведение среды, а не утверждение
                assert.ok(terminalBug.exitStatus != null);

                assert.equal(bugPidResolved, false, 'processId зависшего терминала не должен был разрешится');

                assert.equal(results.length, 2);
                assert.ok(results.includes(PID as ProcessId), 'ответ от нормального терминала должен присутствовать');
                assert.ok(results.includes(undefined), 'ответ от сломанного терминала должен присутствовать');

            }
            finally {
                terminalBug.dispose();
            }
        });

        test(`${/*++N*/'006'/**/} не зависает на зависшем processId — разрешается в undefined по таймауту (синтетика)`, async function () {
            // Имитируем Thenable, который никогда не разрешается, чтобы проверить таймаут

            const timeout = 3_000;
            this.timeout(timeout + 1000);

            const TASK_NAME = 'scenario-1';

            // --------------------------------------------------------------------

            // запускаем задачу, ждем пид задачи от vsc
            const PID = await run_task_and_wait(TASK_NAME, timeout);

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

                const token = cancellationTokenSource!.token;
                // Результат будет получен по достижении timeout
                // НЕ будет висеть вечно
                const results = await Promise.all(
                    [terminalBug, terminalNormal].map(function (terminal) {
                        return getProcessId(terminal, timeout, token);
                    })
                );

                // НЕ сработала ветка "Закрытие терминала"
                // документирует поведение среды, а не утверждение
                assert.ok(terminalBug.exitStatus == null);

                assert.equal(bugPidResolved, false, 'processId зависшего терминала не должен был разрешится');

                assert.equal(results.length, 2);
                assert.ok(results.includes(PID as ProcessId), 'ответ от нормального терминала должен присутствовать');
                assert.ok(results.includes(undefined), 'ответ от сломанного терминала должен присутствовать');

            }
            finally {
                terminalBug.dispose();
            }

        });

    });

    suite('Отмена токена', function () {

        test(`${/*++N*/'007'/**/} реагирует на уже отмененный токен`, async function () {

            const timeout = 3_000;
            this.timeout(timeout + 1000);

            const TASK_NAME = 'scenario-1';

            // --------------------------------------------------------------------

            // запускаем задачу, ждем пид задачи от vsc
            const PID = await run_task_and_wait(TASK_NAME, timeout);

            // Будет открыт нормальный терминал
            assert.equal(vsc.window.terminals.length, 1, `ожидается что открыт ровно один терминал, но открыто ${vsc.window.terminals.length}`);
            const terminalNormal = vsc.window.terminals.at(0);
            assert.ok(terminalNormal);
            assert.equal(await terminalNormal.processId, PID); // не будет проблем

            const cts = new vsc.CancellationTokenSource();
            cts.cancel(); // сразу же отменяем

            await assert.rejects(Promise.all(
                vsc.window.terminals.map(function (terminal) {
                    return getProcessId(terminal, timeout, cts.token);
                })), vsc.CancellationError);

        });

        test(`${/*++N*/'008'/**/} отмена токена во время ожидания`, async function () {

            const timeout = 3_000;
            this.timeout(timeout + 1000);

            let isResolved = false;
            let timer: NodeJS.Timeout | null = null;

            // Создаём нормальный терминал
            const terminal = vsc.window.createTerminal({ name: 'test-cancel-during' });
            // Подменяем processId на меееееедленный
            const slowProcessId = new Promise<number>((resolve) => {
                timer = setTimeout(function () {
                    isResolved = true;
                    resolve(123456789);
                }, 2_500);
            });
            Object.defineProperty(terminal, 'processId', {
                get: () => slowProcessId,
            });

            const cts = new vsc.CancellationTokenSource();

            try {
                const promise = getProcessId(terminal, timeout, cts.token);
                // Отменяем через небольшую задержку, имитируя реальную отмену
                await new Promise(resolve => setTimeout(resolve, 550));
                cts.cancel();
                await assert.rejects(promise, vsc.CancellationError, 'getProcessId должен отклонятся с CancellationError');
                assert.equal(isResolved, false, 'pid не должен успеть');
            } finally {
                if (timer) {
                    clearTimeout(timer);
                }
                terminal.dispose();
                cts.dispose();
            }
        });

    });

});
