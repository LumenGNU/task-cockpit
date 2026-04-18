import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Task from '../../../Workspace/Tasks';
import { resolveScopes } from '../helper-resolveScopes';
import type * as TC from '../../../types.js';

suite('Task.fetch — group normalization', () => {

    test('group property is normalized: string→object, kind capitalized, isDefault defaulted', async () => {

        // --- Контракт фикстуры ---
        const folders = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length === 1 && folders[0]?.name === 'group-normalization',
            `fixture contract expected "group-normalization", got ${folders ? folders.map(f => f.name).join(', ') : '<none>'
            }`);

        const scopes = resolveScopes();
        assert.strictEqual(scopes.length, 1);

        const scopeFile = scopes[0]?.scopeURI.fsPath;
        assert.ok(scopeFile);

        const STRING_GROUP = 'string-group' as TC.TaskName;
        const OBJECT_NO_DEFAULT = 'object-no-default' as TC.TaskName;
        const OBJECT_WITH_DEFAULT = 'object-with-default' as TC.TaskName;
        const EMPTY_KIND = 'empty-kind' as TC.TaskName;

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {
            const { definitionsByFile } = await Task.fetch(scopes, cts.token);

            const defs = definitionsByFile.get(scopeFile);
            assert.ok(defs, `definitionsByFile must have scope key: ${scopeFile}`);
            assert.strictEqual(defs.size, 4, `expected 4 definitions, got ${defs.size}`);

            // --- C9: строка → объект, kind с заглавной, isDefault = false ---
            const stringGroup = defs.get(STRING_GROUP)!.group;
            assert.deepStrictEqual(stringGroup, { kind: 'Build', isDefault: false },
                'string "build" must normalize to { kind: "Build", isDefault: false }');

            // --- C10: объект без isDefault → isDefault = false ---
            const objectNoDefault = defs.get(OBJECT_NO_DEFAULT)!.group;
            assert.deepStrictEqual(objectNoDefault, { kind: 'Test', isDefault: false },
                '{ kind: "test" } must normalize to { kind: "Test", isDefault: false }');

            // --- C11: объект с isDefault: true → сохраняется ---
            const objectWithDefault = defs.get(OBJECT_WITH_DEFAULT)!.group;
            assert.deepStrictEqual(objectWithDefault, { kind: 'Build', isDefault: true },
                '{ kind: "build", isDefault: true } must preserve isDefault');

            // --- C12: пустой kind → group === undefined ---
            // @todo стоит ли тестировать на не корректных данных?
            const emptyKind = defs.get(EMPTY_KIND)!.group;
            assert.strictEqual(emptyKind, undefined,
                '{ kind: "" } must result in group === undefined');

        } finally {
            cts.dispose();
        }
    });
});