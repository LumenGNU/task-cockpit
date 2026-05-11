import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Terminals from '../Runtime/Terminals';
import * as TC from '../types';




const scenarios = [
    'New Terminal Inf Process 1', // Откроет новый терминал, не завершится, не закроет терминал
    'New Terminal Inf Process 2',
    'New Terminal Inf Process 3',
    // Три инстанса одного 'New Terminal Inf Process' использовать не получится
    // из за: "Unexpected: The specified task is missing an execution: CodeExpectedError: Unexpected: The specified task is missing an execution".
    // Точнее: получится, но будет очень шумно

    'New Terminal 3s Auto Close', // Откроет новый терминал, через 3секунды закроет терминал
    // ...
] as const;


let tasksMap: Map<string, vscode.Task>;


/**
 * Возвращает карту задач с именами, указанными в {@link scenarios}.
 * 
 * @throws {Error} если количество задач не совпадает с ожидаемым
 * 
 * @returns Карта задач в формате Map<TC.Name, vscode.Task>
 */
async function fetchTestTasks(): Promise<Map<typeof scenarios[number], vscode.Task>> {

    const tasksMap = new Map<typeof scenarios[number], vscode.Task>();

    const tasks = await vscode.tasks.fetchTasks();
    for (const task of tasks) {
        if (scenarios.includes(task.name as typeof scenarios[number])) {
            tasksMap.set(task.name as typeof scenarios[number], task);
        }
    }

    if (tasksMap.size !== scenarios.length) {
        throw new Error(`Expected ${scenarios.length} tasks, but got ${tasksMap.size}`);
    }

    return tasksMap;
}


async function closeAllTerminals(ms: number = 2500): Promise<void> {
    const terminals = [...vscode.window.terminals];
    if (terminals.length === 0) return;

    await Promise.all(
        terminals.map(terminal => new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                handler.dispose();
                reject(new Error(`Terminal "${terminal.name}" did not close within ${ms}ms`));
            }, ms);

            const handler = vscode.window.onDidCloseTerminal(t => {
                if (t === terminal) {
                    clearTimeout(timeout);
                    handler.dispose();
                    resolve();
                }
            });

            // bug: Could not find pty 1 on pty host: CodeExpectedError: Could not find pty 1 on pty host
            terminal.hide();
            terminal.sendText('\x03', false);
            terminal.dispose();
        }))
    );
}


async function awaitOpenNewTerminal(taskScenario: typeof scenarios[number], ms: number = 10_000): Promise<TC.ProcessId | undefined> {

    return new Promise((resolve, reject) => {

        const timeout = setTimeout(() => {
            handler.dispose();
            reject(new Error(`onDidStartTaskProcess not fired within ${ms}ms`));
        }, ms);

        const handler = vscode.tasks.onDidStartTaskProcess((e) => {
            clearTimeout(timeout);
            handler.dispose();
            resolve(e.processId as TC.ProcessId | undefined);
        });

        vscode.tasks.executeTask(tasksMap.get(taskScenario)!).then(
            () => undefined,
            (e) => {
                clearTimeout(timeout);
                handler.dispose();
                reject(e);
            });
    });
}


async function awaitTerminalsSnapshot(trms: Terminals, timestamp: number, ms: number = 3_000): Promise<TC.TerminalsSnapshot> {

    return new Promise((resolve, reject) => {

        const timeout = setTimeout(() => {
            handler.dispose();
            reject(new Error(`onDidReconcile not fired within ${ms}ms`));
        }, ms);

        const handler = trms.onDidReconcile((e) => {
            clearTimeout(timeout);
            handler.dispose();
            resolve(e);
        });

        trms.reconcile(timestamp);
    });

}


suite('@module MainPanel.Runtime:Terminals', () => {


    suiteSetup(async () => {

        assert.strictEqual(
            vscode.workspace.workspaceFile,
            undefined,
            'Expected single-folder workspace'
        );
        assert.strictEqual(
            vscode.workspace.workspaceFolders?.length,
            1,
            'Expected exactly one workspace folder'
        );
        assert.strictEqual(
            vscode.workspace.workspaceFolders?.[0].name,
            'single-folder',
            'Unexpected folder name'
        );

        // await closeAllTerminals();

        // ждем минуту чтобы VS Code успел инициализировать подсистемы
        console.warn('Waiting 5s ...');
        await new Promise((resolve) => setTimeout(resolve, 5_000));

        tasksMap = await fetchTestTasks();

        // await closeAllTerminals();

    });



    suite('Scenario T1', () => {

        let trms: Terminals;

        setup(async () => {
            trms = new Terminals(1000);
        });

        teardown(async () => {
            trms.dispose();
            await closeAllTerminals();
        });


        // Три живых терминала — все PID попадают в snapshot
        test('reconcile captures all running terminal PIDs', async () => {

            // нет терминалов
            assert.strictEqual(vscode.window.terminals.length, 0, 'Expected no terminals');

            const pids = [
                await awaitOpenNewTerminal('New Terminal Inf Process 1'),
                await awaitOpenNewTerminal('New Terminal Inf Process 2'),
                await awaitOpenNewTerminal('New Terminal Inf Process 3'),
            ] as TC.ProcessId[];

            // теперь три терминалам
            assert.strictEqual(vscode.window.terminals.length, 3, 'Expected 3 terminals');

            pids.forEach(pid => assert.ok(pid, 'Expected valid pid'));

            const snapshot = await awaitTerminalsSnapshot(trms, Date.now());

            assert.strictEqual(snapshot.processIds.size, 3, 'Expected 3 processes in snapshot');
            assert.strictEqual(snapshot.processIds.has(pids[0]), true, 'Expected process 0 in snapshot');
            assert.strictEqual(snapshot.processIds.has(pids[1]), true, 'Expected process 0 in snapshot');
            assert.strictEqual(snapshot.processIds.has(pids[2]), true, 'Expected process 0 in snapshot');

        });


        // Терминал закрывается сам — PID не попадает в snapshot
        test('reconcile excludes closed terminal PID', async () => {

            assert.strictEqual(vscode.window.terminals.length, 0, 'Expected no terminals');

            const pid = await awaitOpenNewTerminal('New Terminal 3s Auto Close') as TC.ProcessId;
            assert.ok(pid, 'Expected valid pid');

            const snapshot1 = await awaitTerminalsSnapshot(trms, 1);
            assert.strictEqual(snapshot1.processIds.size, 1, 'Expected empty snapshot');
            assert.strictEqual(snapshot1.timestamp, 1, 'Expected timestamp 1');
            assert.strictEqual(snapshot1.processIds.has(pid), true, 'Expected process in snapshot');

            await new Promise((resolve) => setTimeout(resolve, 5_000));

            assert.strictEqual(vscode.window.terminals.length, 0, 'Expected terminal to be closed');

            const snapshot2 = await awaitTerminalsSnapshot(trms, 2);
            assert.strictEqual(snapshot2.processIds.size, 0, 'Expected empty snapshot');
            assert.strictEqual(snapshot2.timestamp, 2, 'Expected timestamp 2');

        });

    });

});