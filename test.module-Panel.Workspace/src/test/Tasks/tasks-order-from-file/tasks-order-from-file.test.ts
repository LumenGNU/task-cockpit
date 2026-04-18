import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Task from '../../../Workspace/Tasks';
import { resolveScopes } from '../helper-resolveScopes';
import type * as TC from '../../../types.js';


suite('Task.fetch — tasks order from file', () => {

    // --- Контракт фикстуры ---
    const folders = vscode.workspace.workspaceFolders;
    assert.ok(folders);

    test('tasks are listed in the order specified in order-A/tasks.json', async () => {

        const scope = resolveScopes().find((f) => f.folderName === 'order-A');

        const scopeFile = scope?.scopeURI.fsPath;
        assert.ok(scopeFile);

        // такой порядок в файле
        const tasksOrder = ['AAA', 'P', 'ZZZ', '1', 'BBB'];

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {
            const { definitionsByFile, tasksByFile } = await Task.fetch([scope], cts.token);

            const definitions = definitionsByFile.get(scopeFile);
            const tasks = tasksByFile.get(scopeFile);

            // скопа - ок
            assert.ok(definitions);
            assert.ok(tasks);

            // все задачи прочитаны, лишних нет
            assert.strictEqual(definitions.size, tasksOrder.length);
            assert.strictEqual(tasks.size, tasksOrder.length);

            assert.deepStrictEqual([...definitions.keys()], tasksOrder);
            assert.deepStrictEqual([...tasks.keys()], tasksOrder);


        } finally {
            cts.dispose();
        }
    });

    test('tasks are listed in the order specified in order-B/tasks.json', async () => {

        const scope = resolveScopes().find((f) => f.folderName === 'order-B');

        const scopeFile = scope?.scopeURI.fsPath;
        assert.ok(scopeFile);

        // такой порядок в файле
        const tasksOrder = ['BBB', '1', 'ZZZ', 'P', 'A'];

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {
            const { definitionsByFile, tasksByFile } = await Task.fetch([scope], cts.token);

            const definitions = definitionsByFile.get(scopeFile);
            const tasks = tasksByFile.get(scopeFile);

            // скопа - ок
            assert.ok(definitions);
            assert.ok(tasks);

            // все задачи прочитаны, лишних нет
            assert.strictEqual(definitions.size, tasksOrder.length);
            assert.strictEqual(tasks.size, tasksOrder.length);

            assert.deepStrictEqual([...definitions.keys()], tasksOrder);
            assert.deepStrictEqual([...tasks.keys()], tasksOrder);


        } finally {
            cts.dispose();
        }
    });

});