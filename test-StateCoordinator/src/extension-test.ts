// extension-test.ts

import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


export function activate(context: vscode.ExtensionContext) {

    const extName = `${context.extension.id}+test`;

    const logChannel = vscode.window.createOutputChannel(extName, { log: true });
    assert.ok(logChannel.logLevel <= vscode.LogLevel.Debug);
    logChannel.show();

    logChannel.debug(`${extName} activated`);

    context.subscriptions.push(logChannel);

    return {
        logChannel
    };

}


export function deactivate() {

}
