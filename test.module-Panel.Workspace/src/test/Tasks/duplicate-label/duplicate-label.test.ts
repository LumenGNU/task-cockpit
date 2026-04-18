import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Task from '../../../Workspace/Tasks';
import { resolveScopes } from '../helper-resolveScopes';
import type * as TC from '../../../types.js';

// C14: в definitions один ключ, поля соответствуют второму определению
suite('Task.fetch — duplicate label', () => {

    test('last definition wins when labels collide', async () => {

        // --- Контракт фикстуры ---
        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length === 1 && folders[0]?.name === 'duplicate-label',
            `fixture contract expected "duplicate-label", got ${folders ? folders.map(f => f.name).join(', ') : '<none>'
            }`);

        const scopes = resolveScopes();
        assert.strictEqual(scopes.length, 1);

        const scopeFile = scopes[0]?.scopeURI.fsPath;
        assert.ok(scopeFile);

        const DUP = 'dup' as TC.TaskName;

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {
            const { definitionsByFile } = await Task.fetch(scopes, cts.token);

            const defs = definitionsByFile.get(scopeFile);
            assert.ok(defs, `definitionsByFile must have scope key: ${scopeFile}`);

            // --- Assert: дубликат схлопнулся в одну запись ---
            assert.strictEqual(defs.size, 1,
                `expected 1 definition (last-wins dedup), got ${defs.size}`);

            // --- Assert: победило второе определение ---
            const def = defs.get(DUP)!;
            assert.strictEqual(def.icon.id, 'stop',
                'icon.id must come from the second definition');
            assert.strictEqual(def.group?.kind, 'Test',
                'group.kind must come from the second definition (capitalized)');

        } finally {
            cts.dispose();
        }
    });
});