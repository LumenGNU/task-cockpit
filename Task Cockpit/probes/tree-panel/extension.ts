// extension.ts

import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import WindowConfiguration from '../../src/WindowConfiguration/WindowConfiguration';
import Immutable from '../../src/utils/Immutable';
import Safe from '../../src/utils/Safe';
import { ResourceStateCoordinator } from '../../src/ResourceState/ResourceStateCoordinator';
import ScopeKey from '../../src/ScopeKey';
import TaskName from '../../src/TaskName';
import Panel, { GLOBAL_TREE_VIEW_ID, WORKSPACE_TREE_VIEW_ID } from '../../src/TreeViewPanel/Panel';
import FileDecorationProvider from '../../src/DecorationProvider/FileDecorationProvider';


const BASE_CONFIG_SECTION: string = 'taskCockpit';

interface TaskSource {
    uri: vscode.Uri;
    JSONPath: Array<string>;
}

const logChannel = vscode.window.createOutputChannel('taskCockpit-DEBUG', { log: true });
// assert.ok(logChannel.logLevel <= vscode.LogLevel.Debug);
logChannel.show();

export async function activate(context: vscode.ExtensionContext) {

    logChannel.debug(`[ACTIVATED] ${context.extension.id}`);

    // --------------
    vscode.commands.registerCommand('task-cockpit.settings.configure-filtering', function () {
        return vscode.commands.executeCommand(
            'workbench.action.openWorkspaceSettings',
            { query: '@ext:papio-dev.task-cockpit taskCockpit.filtering' });
    });

    vscode.commands.registerCommand('DEBUG.task-cockpit.TTT', function () {
        void vscode.window.showInformationMessage('task-cockpit.TTT');
    });

    vscode.commands.registerCommand('DEBUG.open-task-in-editor', async function () {
        type Item = vscode.QuickPickItem & { taskSource: Immutable<TaskSource>; taskName: TaskName; };
        const items: Item[] = [];

        const collect = (scopeKey: ScopeKey, scopeName: string) => {
            const taskSource = stateCoordinator.getTaskSource(scopeKey);
            if (taskSource === null) return;
            const definitions = stateCoordinator.getTaskDefinitionEntries(scopeKey);
            if (definitions === null) return;
            for (const [taskName] of definitions) {
                items.push({ label: `${scopeName} › ${taskName}`, taskSource, taskName });
            }
        };



        if (items.length === 0) {
            void vscode.window.showInformationMessage('No tasks found.');
            return;
        }

        const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select a task' });
        if (picked === undefined) return;

        // await openTaskDefinitionInEditor(picked.taskSource, picked.taskName);
    });

    vscode.commands.registerCommand('task-cockpit.force-full-refresh', function () {
        void stateCoordinator.forceFullRefresh();
    });

    // -------------------
    vscode.commands.registerCommand('task-cockpit.view-container.global-task-view.expand-all', function () {
        panel.expandAllInView(GLOBAL_TREE_VIEW_ID);
    });
    vscode.commands.registerCommand('task-cockpit.view-container.workspace-task-view.expand-all', function () {
        panel.expandAllInView(WORKSPACE_TREE_VIEW_ID);
    });
    //

    const windowConfiguration = new WindowConfiguration(logChannel);
    const stateCoordinator = await ResourceStateCoordinator.create(10_000, logChannel);


    vscode.window.registerFileDecorationProvider(new FileDecorationProvider(windowConfiguration, logChannel));

    const panel = new Panel(
        windowConfiguration,
        stateCoordinator,
        logChannel
    );


}



export function deactivate() { }
