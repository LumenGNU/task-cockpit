import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Task from '../../../Workspace/Tasks';
import { resolveScopes } from '../helper-resolveScopes';
import type * as TC from '../../../types.js';

suite('Task.fetch — no tasks array', () => {

    test('valid json without tasks array produces empty maps but scope key is present', async () => {

        // --- Контракт фикстуры ---

        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders);

        const scope = resolveScopes().find((f) => f.folderName === 'no-tasks-array');

        const scopeFile = scope?.scopeURI.fsPath;
        assert.ok(scopeFile);

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {
            const { definitionsByFile, tasksByFile } = await Task.fetch([scope], cts.token);

            // --- Assert: scope-ключ присутствует ---
            assert.ok(definitionsByFile.has(scopeFile),
                'definitionsByFile must have scope key');
            assert.ok(tasksByFile.has(scopeFile),
                'tasksByFile must have scope key');

            // --- Assert: внутренние мапы пусты ---
            assert.strictEqual(definitionsByFile.get(scopeFile)!.size, 0,
                'definitions must be empty when tasks array is absent');
            assert.strictEqual(tasksByFile.get(scopeFile)!.size, 0,
                'tasks must be empty when tasks array is absent');

        } finally {
            cts.dispose();
        }
    });
});