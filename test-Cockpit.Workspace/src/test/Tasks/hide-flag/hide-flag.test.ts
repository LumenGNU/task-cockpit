import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Task from '../../../Workspace/Tasks';
import { resolveScopes } from '../helper-resolveScopes';
import type * as TC from '../../../types.js';

suite('Task.fetch — hide flag', () => {

    test('hide:true in source produces hidden===true in definition; otherwise hidden is not true', async () => {

        // --- Контракт фикстуры ---
        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length === 1 && folders[0]?.name === 'hide-flag',
            `fixture contract expected "hide-flag", got ${folders ? folders.map(f => f.name).join(', ') : '<none>'
            }`);

        const scopes = resolveScopes();
        assert.strictEqual(scopes.length, 1);

        const scopeFile = scopes[0]?.scopeURI.fsPath;
        assert.ok(scopeFile);

        const HIDDEN_TASK = 'hidden-task' as TC.TaskName;
        const VISIBLE_FALSE = 'visible-false' as TC.TaskName;
        const VISIBLE_ABSENT = 'visible-absent' as TC.TaskName;

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {
            const { definitionsByFile } = await Task.fetch(scopes, cts.token);

            const defs = definitionsByFile.get(scopeFile);
            assert.ok(defs, `definitionsByFile must have scope key: ${scopeFile}`);
            assert.strictEqual(defs.size, 3, `expected 3 definitions, got ${defs.size}`);

            // --- Assert: hide:true → hidden === true ---
            const hiddenDef = defs.get(HIDDEN_TASK)!;
            assert.strictEqual(hiddenDef.hidden, true,
                'hide:true in source must produce hidden === true');

            // --- Assert: hide:false → hidden не true ---
            const visibleFalseDef = defs.get(VISIBLE_FALSE)!;
            assert.notEqual(visibleFalseDef.hidden, true,
                'hide:false in source must not produce hidden === true');

            // --- Assert: hide отсутствует → hidden не true ---
            const visibleAbsentDef = defs.get(VISIBLE_ABSENT)!;
            assert.notEqual(visibleAbsentDef.hidden, true,
                'absent hide in source must not produce hidden === true');

        } finally {
            cts.dispose();
        }
    });
});