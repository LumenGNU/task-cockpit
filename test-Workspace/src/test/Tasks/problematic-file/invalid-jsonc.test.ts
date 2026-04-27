import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Task from '../../../Workspace/Tasks';
import { resolveScopes } from '../helper-resolveScopes';
import type * as TC from '../../../types.js';

suite('Task.fetch — invalid jsonc', () => {

    test('non-json content produces empty maps but scope key is present', async () => {

        // --- Контракт фикстуры ---

        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders);

        const scope = resolveScopes().find((f) => f.folderName === 'invalid-jsonc');

        const scopeFile = scope?.scopeURI.fsPath;
        assert.ok(scopeFile);

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {
            const { definitionsByFile, tasksByFile } = await Task.fetch([scope], cts.token);

            // --- Assert: scope-ключ присутствует в обеих мапах ---
            assert.ok(definitionsByFile.has(scopeFile),
                'definitionsByFile must have scope key even with non-json file');
            assert.ok(tasksByFile.has(scopeFile),
                'tasksByFile must have scope key even with non-json file');

            // --- Assert: внутренние мапы пусты ---
            assert.strictEqual(definitionsByFile.get(scopeFile)!.size, 0,
                'definitions must be empty when file is not valid json');
            assert.strictEqual(tasksByFile.get(scopeFile)!.size, 0,
                'tasks must be empty when file is not valid json');

        } finally {
            cts.dispose();
        }
    });
});