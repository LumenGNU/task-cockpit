import * as vscode from 'vscode';

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from './Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


export function activate(context: vscode.ExtensionContext) {

	vscode.window.showInformationMessage('test-extension is now active');

	// #region DEBUG
	log(LogLevel.Debug, 'test-extension is now active');
	// #endregion DEBUG

}



// This method is called when your extension is deactivated
export function deactivate() {
	// #region DEBUG
	Logger.dispose();
	// #endregion DEBUG
}
