import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Task from '../../../Workspace/Tasks';
import { resolveScopes } from '../helper-resolveScopes';
import type * as TC from '../../../types.js';

suite('Task.fetch — icon always object', () => {

    test('icon is always an object, even when absent in source', async () => {

        // --- Контракт фикстуры ---
        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length === 1 && folders[0]?.name === 'icon-always-object',
            `fixture contract expected "icon-always-object", got ${folders ? folders.map(f => f.name).join(', ') : '<none>'
            }`);

        const scopes = resolveScopes();
        assert.strictEqual(scopes.length, 1);

        const scopeFile = scopes[0]?.scopeURI.fsPath;
        assert.ok(scopeFile);

        const WITH_ICON = 'with-icon' as TC.TaskName;
        const WITHOUT_ICON = 'without-icon' as TC.TaskName;

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {
            const { definitionsByFile } = await Task.fetch(scopes, cts.token);

            const defs = definitionsByFile.get(scopeFile);
            assert.ok(defs, `definitionsByFile must have scope key: ${scopeFile}`);
            assert.strictEqual(defs.size, 2, `expected 2 definitions, got ${defs.size}`);

            // --- Assert: задача с icon — поля на месте ---
            const withIcon = defs.get(WITH_ICON)!;
            assert.strictEqual(typeof withIcon.icon, 'object',
                'icon must be an object when defined in source');
            assert.strictEqual(withIcon.icon.id, 'play');

            // --- Assert: задача без icon — объект с пустыми полями, не undefined ---
            const withoutIcon = defs.get(WITHOUT_ICON)!;
            assert.strictEqual(typeof withoutIcon.icon, 'object',
                'icon must be an object even when absent in source');
            assert.strictEqual(withoutIcon.icon.id, undefined,
                'icon.id must be undefined when not specified');
            assert.strictEqual(withoutIcon.icon.color, undefined,
                'icon.color must be undefined when not specified');

        } finally {
            cts.dispose();
        }
    });
});