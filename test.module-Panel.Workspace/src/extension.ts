import * as vscode from 'vscode';
import Workspace from './Workspace';

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from './Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG




export function activate(context: vscode.ExtensionContext) {

	const disposable = vscode.commands.registerCommand('test-extension-activate', async () => {

		vscode.window.showInformationMessage('test-extension is now active');

		// #region DEBUG
		log(LogLevel.Debug, 'test-extension is now active');
		// #endregion DEBUG

		const workspace = new Workspace();

		let dirty = false;

		const listener = workspace.onDidChange(() => { dirty = true; });

		do {
			dirty = false;
			await workspace.reScan();
		} while (dirty);


		listener.dispose();

	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
	// #region DEBUG
	Logger.dispose();
	// #endregion DEBUG
}
