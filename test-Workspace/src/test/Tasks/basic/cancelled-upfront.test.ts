import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Task from '../../../Workspace/Tasks';
import { resolveScopes } from '../helper-resolveScopes';
import type * as TC from '../../../types.js';

suite('Task.fetch — cancelled upfront', () => {

    test('already-cancelled token throws CancellationError immediately', async () => {


        const scopes: TC.Scope[] = [{
            folderName: 'aaa' as TC.FolderName,
            scopeURI: vscode.Uri.file('/aaa/tasks.json') as TC.ScopeUri
        }];


        // --- Exercise ---
        const cts = new vscode.CancellationTokenSource();
        cts.cancel(); // отменяем до вызова

        try {
            await assert.rejects(
                () => Task.fetch(scopes, cts.token),
                vscode.CancellationError,
                'must throw CancellationError when token is already cancelled'
            );
        } finally {
            cts.dispose();
        }
    });
});