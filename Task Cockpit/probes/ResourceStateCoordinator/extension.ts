import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import WindowConfiguration from '../../src/WindowConfiguration/WindowConfiguration';
import { ResourceStateCoordinator } from '../../src/ResourceState/ResourceStateCoordinator';
import Safe from '../../src/utils/Safe';
import ScopeKey from '../../src/ScopeKey';
import Immutable from '../../src/utils/Immutable';
import TaskName from '../../src/TaskName';
import TaskDefinition from '../../src/TaskDefinition';
import ResourceConfig from '../../src/ResourceState/ResourceConfig/Config';
import EligibleTask from '../../src/EligibleTask';
import TaskDefinitionEntry from '../../src/TaskDefinitionEntry';


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
    logChannel.appendLine(`workspace: ${vscode.workspace.name ?? vscode.workspace.workspaceFolders?.[0] ? `"${vscode.workspace.workspaceFolders![0]?.name}"` : '(none)'}`);

    void vscode.window.showInformationMessage(`"${extName}" activated`);
    logChannel.show();

    await run(context.subscriptions, logChannel, traceChannel);
}

async function run(
    subscriptions: { dispose(): any; }[],
    logChannel: vscode.OutputChannel,
    traceChannel: vscode.LogOutputChannel
) {

    logChannel.appendLine('-'.repeat(80));

    const windowConfiguration = new WindowConfiguration(traceChannel);
    const coordinator = await ResourceStateCoordinator.create(10_000, traceChannel);

    const listener1 = windowConfiguration.onDidChange((affectedKeys) => {
        logChannel.appendLine(`Window configuration changed. Changes in: ${[...affectedKeys.keys()].map((k) => `"${k}"`).join(', ')}`);
        for (const key of affectedKeys) {
            logChannel.appendLine(`  • ${key}: ${JSON.stringify(windowConfiguration.getConfig(key))}`);
        }
    });

    const listener2 = coordinator.onDidChange((affectedKeys) => {
        logChannel.appendLine(`Scoped configuration changed. Changes in: ${[...affectedKeys.keys()].map((k) => `"${k}"`).join(', ')}`);
        logChannel.appendLine('New per scope state:');
        printPerScopeState(coordinator, logChannel);
    });

    subscriptions.push(listener1);
    subscriptions.push(listener2);
    subscriptions.push(windowConfiguration);

    logChannel.appendLine('Initial window configuration:');
    windowConfiguration.availableKeys.forEach((k) => {
        logChannel.appendLine(`  • ${k}: ${JSON.stringify(windowConfiguration.getConfig(k))}`);
    });
    logChannel.appendLine('Initial per scope state:');
    printPerScopeState(coordinator, logChannel);

}

function printPerScopeState(coordinator: Safe<ResourceStateCoordinator>, logChannel: vscode.OutputChannel) {

    function pprint(
        name: string,
        configObj: ResourceConfig | null,
        taskDefinitions: Immutable<Map<TaskName, TaskDefinitionEntry>> | null,
        getEligibleTasks: Immutable<Map<TaskName, EligibleTask>> | null
    ) {

        assert.ok(configObj);
        assert.ok(taskDefinitions);


        logChannel.appendLine(`  "${name}"`);
        logChannel.appendLine(`    Configuration:`);
        for (const [k, v] of Object.entries(configObj)) {
            logChannel.appendLine(`      • ${k}:${JSON.stringify(v)}`);
        }
        logChannel.appendLine(`    Tasks:`);
        if (taskDefinitions.size < 1) {
            logChannel.appendLine(`      « no tasks in this scope »`);
        }
        for (const [taskName, _definition] of taskDefinitions) {
            const hasRuntimeTask = getEligibleTasks?.has(taskName) ?? false;
            logChannel.appendLine(`      ${hasRuntimeTask ? '•' : '‼'} ${TaskName.formatTaskName(taskName, configObj.Hierarchy.segmentSeparator)}`);
        }

    }


    const scopeLayout = coordinator.getScopeLayout();

    const globalLayout = scopeLayout.globalScope;
    pprint(
        globalLayout.name,
        coordinator.getResourceConfig(ScopeKey.GLOBAL_KEY),
        coordinator.getTaskDefinitions(ScopeKey.GLOBAL_KEY),
        coordinator.getEligibleTasks(ScopeKey.GLOBAL_KEY)
    );

    const workspaceLayout = scopeLayout.workspaceScope;
    if (workspaceLayout) {
        pprint(
            workspaceLayout.name,
            coordinator.getResourceConfig(ScopeKey.WORKSPACE_KEY),
            coordinator.getTaskDefinitions(ScopeKey.WORKSPACE_KEY),
            coordinator.getEligibleTasks(ScopeKey.WORKSPACE_KEY)
        );
    }

    const folders = scopeLayout.folderScopes;
    if (folders) {
        for (const folderScope of scopeLayout.folderScopes) {
            pprint(
                folderScope.name,
                coordinator.getResourceConfig(folderScope.key),
                coordinator.getTaskDefinitions(folderScope.key),
                coordinator.getEligibleTasks(folderScope.key)
            );
        }
    }
}

export function deactivate(): void {

}
