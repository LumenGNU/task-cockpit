import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { WindowConfiguration } from './WindowConfiguration/WindowConfiguration';
import { ResourceStateCoordinator } from './ResourceState/ResourceStateCoordinator';
import Safe from './utils/Safe';
import ScopeKey from './ScopeKey';
import Immutable from './utils/Immutable';
import TaskName from './TaskName';
import TaskDefinition from './ResourceState/TaskDefinition/TaskDefinition';
import ResourceConfig from './ResourceState/ResourceConfig/Config';
import Scope from './ResourceState/Scope';
import EligibleTask from './EligibleTask';

const logChannel = vscode.window.createOutputChannel('taskCockpit-DEBUG', { log: true });
assert.ok(logChannel.logLevel <= vscode.LogLevel.Debug);
logChannel.show();

export async function activate(context: vscode.ExtensionContext): Promise<void> {

    logChannel.debug(`[ACTIVATED] ${context.extension.id}`);

    const windowConfiguration = new WindowConfiguration(logChannel);
    const coordinator = await ResourceStateCoordinator.create(10_000, logChannel);

    const listener1 = windowConfiguration.onDidChange((affectedKeys) => {
        logChannel.debug(`Window configuration changed. Changes in: ${[...affectedKeys.keys()].map((k) => `"${k}"`).join(', ')}`);
        for (const key of affectedKeys) {
            logChannel.debug(`  • ${key}: ${JSON.stringify(windowConfiguration.getConfig(key))}`);
        }
    });

    const listener2 = coordinator.onDidChange((affectedKeys) => {
        logChannel.debug(`Scoped configuration changed. Changes in: ${[...affectedKeys.keys()].map((k) => `"${k}"`).join(', ')}`);
        logChannel.debug('New per scope state:');
        printPerscopeState(coordinator);
    });

    context.subscriptions.push(listener1);
    context.subscriptions.push(listener2);
    context.subscriptions.push(windowConfiguration);

    logChannel.debug('Initial window configuration:');
    windowConfiguration.availableKeys.forEach((k) => {
        logChannel.debug(`  • ${k}: ${JSON.stringify(windowConfiguration.getConfig(k))}`);
    });
    logChannel.debug('Initial per scope state:');
    printPerscopeState(coordinator);

}

function printPerscopeState(coordinator: Safe<ResourceStateCoordinator>) {

    function pprint(
        name: string,
        configObj: ResourceConfig,
        taskDefinitions: Immutable<Map<TaskName, TaskDefinition>>,
        getEligibleTasks: Immutable<Map<TaskName, EligibleTask>> | null
    ) {
        logChannel.debug(`  "${name}"`);
        logChannel.debug(`    Configuration:`);
        for (const [k, v] of Object.entries(configObj)) {
            logChannel.debug(`      • ${k}:${JSON.stringify(v)}`);
        }
        logChannel.debug(`    Tasks:`);
        if (taskDefinitions.size < 1) {
            logChannel.debug(`      « no tasks in this scope »`);
        }
        for (const [taskName, _definition] of taskDefinitions) {
            const hasRuntimeTask = getEligibleTasks?.has(taskName) ?? false;
            logChannel.debug(`      ${hasRuntimeTask ? '•' : '‼'} ${TaskName.formatTaskName(taskName, configObj.Hierarchy.segmentSeparator)}`);
        }

    }


    const scopeLayout = coordinator.getScopeLayout();

    const globalLayout = scopeLayout[ScopeKey.GLOBAL_KEY];
    pprint(
        globalLayout.name,
        coordinator.getResourceConfig(ScopeKey.GLOBAL_KEY)!,
        coordinator.getTaskDefinitions(ScopeKey.GLOBAL_KEY)!,
        coordinator.getEligibleTasks(ScopeKey.GLOBAL_KEY)
    );

    const workspaceLayout = scopeLayout[ScopeKey.WORKSPACE_KEY];
    if (workspaceLayout) {
        pprint(
            workspaceLayout.name,
            coordinator.getResourceConfig(ScopeKey.WORKSPACE_KEY)!,
            coordinator.getTaskDefinitions(ScopeKey.WORKSPACE_KEY)!,
            coordinator.getEligibleTasks(ScopeKey.WORKSPACE_KEY)
        );
    }

    const folders = scopeLayout.folders;
    if (folders) {
        for (const [folderKey, folderLayout] of Object.entries(folders)) {
            pprint(
                folderLayout.name,
                coordinator.getResourceConfig(folderKey as ScopeKey.FolderKey)!,
                coordinator.getTaskDefinitions(folderKey as ScopeKey.FolderKey)!,
                coordinator.getEligibleTasks(folderKey as ScopeKey.FolderKey)!
            );
        }
    }
}

export function deactivate(): void {
    logChannel.dispose();
}
