import * as vscode from 'vscode';
import Runtime from './Runtime/Runtime';
import TaskIdentifier from './Runtime/TaskIdentifier';
import WorkspaceKey from './Scope/Workspace/Key';

const logChannel = vscode.window.createOutputChannel('Task Cockpit DEBUG Extension', { log: true });


export function activate(context: vscode.ExtensionContext) {

    vscode.window.showInformationMessage('Task Cockpit DEBUG Extension activated');

    logChannel.info('Task Cockpit DEBUG Extension activated');

    const runtime = new Runtime(
        {
            monitor: {
                polling: {
                    min: 322,
                    cap: 550,
                    acceleration: 0.2
                }
            },
            terminals: {
                timeout: 1_300
            }
        },
        logChannel
    );

    runtime.onDidChange(handler, runtime);

}


function handler(this: Runtime, e: TaskIdentifier) {

    logChannel.info(`Change: ${printTaskIdentifier(e)}`, ', state:', this.registry.Stats.get(e.scopeKey)?.get(e.taskName));

}


function printTaskIdentifier({ scopeKey, taskName }: TaskIdentifier) {

    return `${(scopeKey === WorkspaceKey)
        ? '$Workspace'
        : scopeKey.split('/').at(-1)} * ${taskName}`;

}


// This method is called when your extension is deactivated
export function deactivate() {

}
