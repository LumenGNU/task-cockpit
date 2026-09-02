// extension.ts

import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import WindowSettings from '../../src/WindowSettings/WindowSettings';
import Immutable from '../../src/utils/Immutable';
import LifecycleOmitted from '../../src/utils/LifecycleOmitted';
import ResourceStateCoordinator from '../../src/ResourceStateCoordinator/ResourceStateCoordinator';
import OriginKey from '../../src/OriginKey';
import TaskName from '../../src/TaskName';
import TreeViewPanel from '../../src/TreeViewPanel/TreeViewPanel';
import FileDecorationProvider from '../../src/FileDecorationProvider/FileDecorationProvider';
import { USER_TREE, PROJECT_TREE_VIEW } from '../../src/common';
import TaskProcessLifecycle from '../../src/Runtime/TaskProcessLifecycle';



const BASE_CONFIG_SECTION: string = 'taskCockpit';

interface TaskSource {
    uri: vscode.Uri;
    JSONPath: Array<string>;
}

const logOutputChannel = vscode.window.createOutputChannel('taskCockpit-DEBUG', { log: true });
// assert.ok(logChannel.logLevel <= vscode.LogLevel.Debug);
logOutputChannel.show();

export async function activate(context: vscode.ExtensionContext) {

    logOutputChannel.debug(`[ACTIVATED] ${context.extension.id}`);

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
        // type Item = vscode.QuickPickItem & { taskSource: Immutable<TaskSource>; taskName: TaskName; };
        // const items: Item[] = [];

        // const collect = (scopeKey: OriginKey, scopeName: string) => {
        //     const taskSource = stateCoordinator.getTaskSource(scopeKey);
        //     if (taskSource === null) return;
        //     const definitions = stateCoordinator.getTaskDefinitionEntries(scopeKey);
        //     if (definitions === null) return;
        //     for (const [taskName] of definitions) {
        //         items.push({ label: `${scopeName} › ${taskName}`, taskSource, taskName });
        //     }
        // };



        // if (items.length === 0) {
        //     void vscode.window.showInformationMessage('No tasks found.');
        //     return;
        // }

        // const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select a task' });
        // if (picked === undefined) return;

        // // await openTaskDefinitionInEditor(picked.taskSource, picked.taskName);
    });

    vscode.commands.registerCommand('task-cockpit.force-full-refresh', function () {
        if (resourceStateCoordinator.disposed) { return; }
        void resourceStateCoordinator.forceFullRefresh();
    });

    vscode.commands.registerCommand('_debug.force-full-refresh', function () {
        if (resourceStateCoordinator.disposed) { return; }
        void resourceStateCoordinator.forceFullRefresh();
    });

    vscode.commands.registerCommand('_debug._', function () {
        return;
    });

    // -------------------
    vscode.commands.registerCommand('task-cockpit.view-container.global-task-view.expand-all', function () {
        panel.expandAllInView(USER_TREE.ID);
    });
    vscode.commands.registerCommand('task-cockpit.view-container.workspace-task-view.expand-all', function () {
        panel.expandAllInView(PROJECT_TREE_VIEW.ID);
    });
    //

    const windowSettings = new WindowSettings(logOutputChannel);
    const resourceStateCoordinator = await ResourceStateCoordinator.create(10_000, logOutputChannel);
    const runtime = new TaskProcessLifecycle({
        windowSettings,
        resourceStateCoordinator
    }, logOutputChannel);

    const dep = {
        windowSettings,
        resourceStateCoordinator,
        processRegistry: runtime.taskProcessRegistry
    };


    vscode.window.registerFileDecorationProvider(new FileDecorationProvider(dep, logOutputChannel));


    // setTimeout(() => {
    //     resourceStateCoordinator.dispose();
    // }, 15_000);


    const panel = new TreeViewPanel(dep, logOutputChannel);

}



export function deactivate() { }
