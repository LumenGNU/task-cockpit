

import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Task from '../../../Workspace/Tasks';
import { resolveScopes } from '../helper-resolveScopes';
import type * as TC from '../../../types.js';

// C7+C8: у сломанной isBroken === true, её нет в tasksByFile; у нормальной isBroken не установлен, она есть
suite('Task.fetch — broken definition', () => {

    test('definition without a matching vscode.Task is kept with isBroken=true; valid neighbor is intact and present in tasks', async () => {

        // --- Setup ---

        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders);

        const scope = resolveScopes().find((f) => f.folderName === 'broken-definition');

        const scopeFile = scope?.scopeURI.fsPath;
        assert.ok(scopeFile);

        // --- Precondition ---
        // Без этой проверки тест становится тавтологией: "ghost" отсутствует
        // в tasksByFile не потому, что isBroken-ветка сработала, а потому
        // что VS Code вообще его не создал.
        const vscodeTasks = await vscode.tasks.fetchTasks();
        const aliveVisible = vscodeTasks.some(t => t.name === 'alive');
        assert.ok(aliveVisible,
            'precondition: vscode.tasks.fetchTasks() must contain "alive"; fixture or env is broken');

        const ghostVisible = vscodeTasks.some(t => t.name === 'ghost');
        assert.ok(!ghostVisible,
            'precondition: vscode.tasks.fetchTasks() must NOT contain "ghost" (its type is nonexistent); isBroken scenario is not reproduced');

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {
            const { tasksByFile, definitionsByFile } = await Task.fetch([scope], cts.token);

            // --- Assert: scope key present in both maps ---
            assert.ok(definitionsByFile.has(scopeFile),
                `definitionsByFile must have scope key: ${scopeFile}`);
            assert.ok(tasksByFile.has(scopeFile),
                `tasksByFile must have scope key: ${scopeFile}`);

            const defs = definitionsByFile.get(scopeFile)!;
            const tasks = tasksByFile.get(scopeFile)!;

            const GHOST = 'ghost' as TC.TaskName;
            const ALIVE = 'alive' as TC.TaskName;

            // --- Assert: both definitions parsed from the file ---
            assert.strictEqual(defs.size, 2,
                `expected 2 definitions, got ${defs.size}`);
            assert.ok(defs.has(GHOST), 'definitions must contain "ghost"');
            assert.ok(defs.has(ALIVE), 'definitions must contain "alive"');

            // --- Assert: isBroken marker (strict true/not-true) ---
            const ghostDef = defs.get(GHOST)!;
            const aliveDef = defs.get(ALIVE)!;
            assert.strictEqual(ghostDef.isBroken, true,
                '"ghost" must be marked isBroken === true');
            assert.notEqual(aliveDef.isBroken, true,
                '"alive" must not be marked isBroken === true');

            // --- Assert: tasksByFile filtered accordingly ---
            assert.strictEqual(tasks.size, 1,
                `expected exactly 1 vscode.Task in scope, got ${tasks.size}`);
            assert.ok(tasks.has(ALIVE), 'tasksByFile must contain "alive"');
            assert.ok(!tasks.has(GHOST), 'tasksByFile must NOT contain "ghost"');

        } finally {
            cts.dispose();
        }

    });
});