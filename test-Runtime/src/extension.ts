import * as vscode from 'vscode';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from './Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


export function activate(_context: vscode.ExtensionContext) {


}

// This method is called when your extension is deactivated
export function deactivate() {
	// #region DEBUG
	Logger.dispose();
	// #endregion DEBUG
}
