import * as vscode from 'vscode';
import { ProcessRegistry } from "../../src/Runtime/ProcessRegistry";
import WindowConfiguration from "../../src/WindowConfiguration/WindowConfiguration";
import Runtime from "../../src/Runtime/Runtime";
import ScopeKey from '../../src/ScopeKey';
import TaskName from '../../src/TaskName';
import { ResourceStateCoordinator } from "../../src/ResourceState/ResourceStateCoordinator";

export async function activate(context: vscode.ExtensionContext): Promise<void> {

    const ext = context.extension;
    const extName = ext.packageJSON['displayName'];

    const logChannel = vscode.window.createOutputChannel(extName);
    const traceChannel = vscode.window.createOutputChannel(`${extName} - trace`, { log: true });
    context.subscriptions.push(logChannel, traceChannel);

    logChannel.appendLine(`extension: ${ext.id} ${ext.packageJSON['version']}`);
    logChannel.appendLine(`mode: ${vscode.ExtensionMode[context.extensionMode]}`);
    logChannel.appendLine(`vscode: ${vscode.version}`);
    logChannel.appendLine(`node: ${process.version} ${process.platform} ${process.arch}`);
    logChannel.appendLine(`log level: ${vscode.LogLevel[traceChannel.logLevel]}`);
    logChannel.appendLine(`workspace: ${vscode.workspace.name ? vscode.workspace.name : vscode.workspace.workspaceFolders?.[0] ? `"${vscode.workspace.workspaceFolders![0]?.name}"` : '(none)'}`);

    void vscode.window.showInformationMessage(`"${extName}" activated`);
    logChannel.show();

    await run(context.subscriptions, logChannel, traceChannel);
}

export function deactivate(): void { }


// ----------------------------------------------

async function run(
    subscriptions: { dispose(): any; }[],
    logChannel: vscode.OutputChannel,
    traceChannel: vscode.LogOutputChannel
) {

    logChannel.appendLine('-'.repeat(80));

    const windowConfiguration = new WindowConfiguration(traceChannel);
    const processRegistry = new ProcessRegistry(traceChannel);
    const resourceStateCoordinator = await ResourceStateCoordinator.create(10_000, traceChannel);
    const runtime = new Runtime(
        windowConfiguration,
        processRegistry,
        traceChannel
    );

    subscriptions.push(
        windowConfiguration,
        processRegistry,
        runtime
    );

    processRegistry.onDidChangeTaskProcesses((e) => {
        e.forEach((taskNames, scopeKey) => {
            const segmentSeparator = resourceStateCoordinator.getResourceConfig(scopeKey)?.Hierarchy.segmentSeparator;
            taskNames.forEach((taskName) => {
                const taskState = processRegistry.getState(scopeKey, taskName);
                logChannel.appendLine(`${ScopeKey.resolveScopeName(scopeKey)}: ${TaskName.formatTaskName(taskName, segmentSeparator)} - ${taskState?.size}`);
            });
        });
    });

}
