// extension.ts

import * as vscode from 'vscode';
import StateCoordinator from './StateCoordinator/StateCoordinator';
import * as assert from 'node:assert/strict';
import getDisplayName from './Scope/getDisplayName';
import WindowConfig from './StateCoordinator/ConfigSchema/Window/Config';
import ResourceConfig from './StateCoordinator/ConfigSchema/Resource/Config';
import formatTaskName from './TaskName/formatTaskName';
import Immutable from './utils/Immutable';


const logChannel = vscode.window.createOutputChannel('taskCockpit-DEBUG', { log: true });
assert.ok(logChannel.logLevel <= vscode.LogLevel.Debug);
logChannel.show();

export async function activate(context: vscode.ExtensionContext) {

    console.log(`${context.extension.id} activated!`);
    logChannel.debug(`${context.extension.id} activated!`);

    const coordinator = await StateCoordinator.create(
        'taskCockpit',
        15_000,
        logChannel
    );

    assert.ok(coordinator);
    logChannel.debug(`coordinator create`);


    coordinator.onDidChange((changeSet) => {
        printState(coordinator, changeSet);
    });

    printState(coordinator, null);
}


function printState(coordinator: Immutable<StateCoordinator>, changeSet: Immutable<StateCoordinator.ChangeSet> | null) {

    logChannel.debug('');
    logChannel.debug('');
    logChannel.debug('======================== Configuration State ========================');

    logChannel.debug('');
    logChannel.debug('---------------------------------------------------------------------');


    const wndowConfigurationHasChanges = changeSet == null || [...changeSet].some(v => !['BASE', 'TASKS'].includes(v));
    logChannel.debug(`Window Configuration${wndowConfigurationHasChanges ? '' : ' <no changes>'}:`);

    const windowConfig = coordinator.getWindowConfig();

    for (const k in windowConfig) {
        logChannel.debug(` ${`${changeSet?.has(k as StateCoordinator.ChangeKey) ? '• * ' : '• '}${k}`.padEnd(24)}: ${JSON.stringify(windowConfig[k as keyof WindowConfig])}`);
    }


    const scope = coordinator.getScopes();

    logChannel.debug('');
    logChannel.debug('---------------------------------------------------------------------');
    logChannel.debug(`Scoped Configuration. ${scope.length} scope(s):`);

    logChannel.debug('');

    scope.forEach((scope) => {

        const displayName = getDisplayName(scope);
        logChannel.debug(` > "${displayName}"`);

        logChannel.debug(`     Configuration:`);
        // -----------------
        const resourceConfig = coordinator.getResourceConfig(scope);
        for (const k in resourceConfig) {
            logChannel.debug(`        • ${k.padEnd(12)}: ${JSON.stringify(resourceConfig[k as keyof ResourceConfig])}`);
        }

        logChannel.debug(`     Tasks:`);
        // ------------

        const taskDefinitions = coordinator.getTaskDefinitions(scope);
        const eligibleTasks = coordinator.getEligibleTasks(scope);

        if (taskDefinitions.size < 1) {
            logChannel.debug('        { no tasks }');
        }

        const { Hierarchy: { segmentSeparator } } = coordinator.getResourceConfig(scope);

        taskDefinitions.forEach((taskDefinition) => {
            const taskName = taskDefinition.taskName;
            logChannel.debug(`        ${eligibleTasks.has(taskName) ? '•' : '‼'} ${formatTaskName(taskName, segmentSeparator)}`);
        });

        logChannel.debug(' ');
    });


    logChannel.debug('');
    logChannel.debug('');
}


export function deactivate() { }
