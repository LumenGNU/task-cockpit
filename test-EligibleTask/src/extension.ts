import * as vscode from 'vscode';


const logChannel = vscode.window.createOutputChannel('Task Cockpit DEBUG Extension', { log: true });


export function activate(context: vscode.ExtensionContext) {

    vscode.window.showInformationMessage('Task Cockpit DEBUG Extension activated');

}


// This method is called when your extension is deactivated
export function deactivate() {

}
