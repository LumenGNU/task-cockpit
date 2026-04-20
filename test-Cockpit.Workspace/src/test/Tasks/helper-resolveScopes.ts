/** @file test/helpers/resolveScopes.ts */

import * as vscode from 'vscode';
import type * as TC from '../../types.js';

/** Копия приватного метода из основного модуля.
 *
 * @warn Синхронизация с оригиналом ручная — если там что-то изменится,
 *   этот хелпер останется прежним, и тесты начнут проверять устаревший контракт. */
export function resolveScopes(): Array<TC.Scope> {
    const scopes: Array<TC.Scope> = [];
    if (vscode.workspace.workspaceFile) {
        scopes.push({
            folderName: (vscode.workspace.name ?? '<unnamed>') as TC.FolderName,
            scopeURI: vscode.workspace.workspaceFile as TC.ScopeUri
        });
    }
    if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
            scopes.push({
                folderName: folder.name as TC.FolderName,
                scopeURI: vscode.Uri.joinPath(folder.uri, '.vscode', 'tasks.json') as TC.ScopeUri
            });
        }
    }
    return scopes;
}