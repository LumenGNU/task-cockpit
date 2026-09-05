import * as vscode from 'vscode';

export interface IFixture {
    getFileUri(relativePath: string): vscode.Uri;
}

export function activate(_context: vscode.ExtensionContext): IFixture {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        const msg = 'Нет открытого рабочего пространства';
        vscode.window.showErrorMessage(msg);
        throw new Error(msg);
    }

    const rootUri = workspaceFolders[0]!.uri;

    return {
        getFileUri(relativePath: string): vscode.Uri {
            return vscode.Uri.joinPath(rootUri, relativePath);
        }
    };
}

export function deactivate(): void { }

export default IFixture;
