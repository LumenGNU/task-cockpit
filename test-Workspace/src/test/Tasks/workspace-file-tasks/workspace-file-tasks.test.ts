import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Task from '../../../Workspace/Tasks';
import { resolveScopes } from '../helper-resolveScopes';
import type * as TC from '../../../types.js';

suite('Task.fetch — workspace file tasks', () => {

    test('tasks defined in .code-workspace are read via correct json path', async () => {

        // --- Контракт фикстуры ---
        const wsFile = vscode.workspace.workspaceFile;
        assert.ok(wsFile, 'fixture contract expected multi-root workspace with .code-workspace file');
        assert.ok(wsFile.fsPath.includes('workspace-file-tasks'),
            `fixture contract expected "workspace-file-tasks" workspace, got ${wsFile.fsPath}`);

        // --- Собираем только workspace scope ---
        const workspaceScope: TC.Scope = {
            folderName: (vscode.workspace.name ?? '<unnamed>') as TC.FolderName,
            scopeURI: wsFile as TC.ScopeUri
        };

        const scopeFile = workspaceScope.scopeURI.fsPath;

        const WS_TASK = 'ws-task' as TC.TaskName;

        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        try {
            const { definitionsByFile } = await Task.fetch([workspaceScope], cts.token);

            const defs = definitionsByFile.get(scopeFile);
            assert.ok(defs, `definitionsByFile must have workspace scope key: ${scopeFile}`);

            // --- Assert: задача из .code-workspace распарсилась ---
            assert.strictEqual(defs.size, 1, `expected 1 definition, got ${defs.size}`);
            assert.ok(defs.has(WS_TASK), 'definitions must contain "ws-task"');

        } finally {
            cts.dispose();
        }
    });
});