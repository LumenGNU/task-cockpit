import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Task from '../../../Workspace/Tasks';
import type * as TC from '../../../types.js';


// C3: порядок итерации definitionsByFile.get(file) = порядок в файле
suite('Task.fetch — scope order preserving', () => {

    // Порядок имеет смысл
    const names = ['zebra', 'apple', 'middle', '1', 'beta'];

    const reversed = [...names].reverse();

    test('result map key order matches input scopes order (forward)', async () => {


        const scopes: TC.Scope[] = names.map((n) => ({
            folderName: n as TC.FolderName,
            scopeURI: vscode.Uri.file(`${n}/.vscode/tasks.json`) as TC.ScopeUri
        }));

        const expectedOrder = scopes.map((s) => s.scopeURI.fsPath);

        assert.ok(expectedOrder.length > 1);

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {

            {
                const { definitionsByFile, tasksByFile } = await Task.fetch(scopes, cts.token);

                // --- Assert: количество ---
                assert.strictEqual(definitionsByFile.size, expectedOrder.length,
                    `expected ${expectedOrder.length} definitions, got ${definitionsByFile.size}`);

                assert.strictEqual(tasksByFile.size, expectedOrder.length,
                    `expected ${expectedOrder.length} definitions, got ${tasksByFile.size}`);

                // --- Assert: порядок итерации Map совпадает с порядком в файле ---

                assert.deepStrictEqual([...definitionsByFile.keys()], expectedOrder,
                    `iteration order must match file order`);

                assert.deepStrictEqual([...tasksByFile.keys()], expectedOrder,
                    `iteration order must match file order`);
            }


        } finally {
            cts.dispose();
        }
    });

    test('result map key order matches input scopes order (reversed)', async () => {


        const scopes: TC.Scope[] = reversed.map((n) => ({
            folderName: n as TC.FolderName,
            scopeURI: vscode.Uri.file(`${n}/.vscode/tasks.json`) as TC.ScopeUri
        }));

        const expectedOrder = scopes.map((s) => s.scopeURI.fsPath);

        assert.ok(expectedOrder.length > 1);

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {

            {
                const { definitionsByFile, tasksByFile } = await Task.fetch(scopes, cts.token);

                // --- Assert: количество ---
                assert.strictEqual(definitionsByFile.size, expectedOrder.length,
                    `expected ${expectedOrder.length} definitions, got ${definitionsByFile.size}`);

                assert.strictEqual(tasksByFile.size, expectedOrder.length,
                    `expected ${expectedOrder.length} definitions, got ${tasksByFile.size}`);

                // --- Assert: порядок итерации Map совпадает с порядком в файле ---

                assert.deepStrictEqual([...definitionsByFile.keys()], expectedOrder,
                    `iteration order must match file order`);

                assert.deepStrictEqual([...tasksByFile.keys()], expectedOrder,
                    `iteration order must match file order`);
            }


        } finally {
            cts.dispose();
        }
    });
});