import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Task from '../../../Workspace/Tasks';
import { resolveScopes } from '../helper-resolveScopes';
import type * as TC from '../../../types.js';


// C5: в definitions только нормальная; precondition: fetchTasks() содержит безлейбловую
suite('Task.fetch — unlabeled task', () => {

    test('definition without label is excluded from definitionsByFile', async () => {

        // --- Контракт фикстуры ---

        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders);

        const scope = resolveScopes().find((f) => f.folderName === 'unlabeled-task');

        const scopeFile = scope?.scopeURI.fsPath;
        assert.ok(scopeFile);

        // --- Precondition ---
        // VS Code должна знать про npm-таску из tasks.json.
        // Без этого тест — тавтология: определение отсутствует в результате
        // не потому что наш код отфильтровал, а потому что в файле
        // ничего рабочего не было.
        const vscodeTasks = await vscode.tasks.fetchTasks();

        const TEST = 'test' as TC.TaskName;
        const BUILD = 'build' as TC.TaskName;

        const npmTaskVisible = vscodeTasks.some(t =>
            t.definition.type === 'npm' && t.definition.script === TEST
        );
        assert.ok(npmTaskVisible,
            'precondition: fetchTasks() must contain npm "test" task; npm provider or package.json missing');

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {
            const { definitionsByFile, tasksByFile } = await Task.fetch([scope], cts.token);

            const defs = definitionsByFile.get(scopeFile);
            assert.ok(defs, `definitionsByFile must have scope key: ${scopeFile}`);

            // --- Assert: только задача с label попала в definitions ---
            assert.strictEqual(defs.size, 1,
                `expected 1 definition (only labeled), got ${defs.size}`);
            assert.ok(defs.has(BUILD), 'definitions must contain "build"');
            assert.ok(!defs.has(TEST), 'definitions must NOT contain unlabeled npm task');

            // --- Assert: tasksByFile тоже содержит только "build" ---
            const tasks = tasksByFile.get(scopeFile)!;
            assert.strictEqual(tasks.size, 1,
                `expected 1 task in tasksByFile, got ${tasks.size}`);
            assert.ok(tasks.has(BUILD), 'tasksByFile must contain "build"');

        } finally {
            cts.dispose();
        }
    });
});