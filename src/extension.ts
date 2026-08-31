
import {
    window,
    LogOutputChannel,
    type ExtensionContext,
    commands,
    Uri,
    tasks,
    Task,
    ThemeIcon,
    env,
    Disposable
} from 'vscode';
import TaskProcessLifecycle from './Runtime/TaskProcessLifecycle';
import WindowSettings from './WindowSettings/WindowSettings';
import ResourceStateCoordinator from './ResourceStateCoordinator/ResourceStateCoordinator';
import FileDecorationProvider from './FileDecorationProvider/FileDecorationProvider';
import DiagnosticsManager from './TasksSource/Diagnostics/DiagnosticsManager';
import TreeViewPanel from './TreeViewPanel/TreeViewPanel';
import {
    COMMAND_IDS,
    GLOBAL_TREE_VIEW,
    ID,
    PROJECT_TREE_VIEW,
    SETTING_IDS
} from './common';
import openTaskDefinitionInEditor from './TasksSource/openTaskDefinitionInEditor';
import TaskNodeData from './TreeViewPanel/TaskNodeData';
import OriginKey from './OriginKey';
import AsyncQueue from './utils/AsyncQueue';
import Services from './extension/Services';
import resolveTreeElement from './extension/resolveTreeElement';

import navigateToTerminal from './extension/navigateToTerminal';
import Element from './TreeViewPanel/TreeView/Element/Element';
import type Immutable from './utils/Immutable';
import * as assert from 'node:assert/strict';


let logOutputChannel: LogOutputChannel | undefined;

export async function activate(context: ExtensionContext): Promise<void> {

    const extDisplayName = context.extension.packageJSON['displayName'] as string;
    const logOutputChannel = window.createOutputChannel(extDisplayName, { log: true });

    const services = await Services.createServices(context, logOutputChannel);

    context.subscriptions.push(
        ...Object.values(services),
        window.registerFileDecorationProvider(services.fileDecorationProvider),
    );

    registerCommands(context, services, logOutputChannel);

}

export function deactivate(): void {
    logOutputChannel?.dispose();
}


function registerCommands(
    context: ExtensionContext,
    services: Readonly<Services>,
    logOutputChannel: LogOutputChannel
) {


    const taskExecQueue = AsyncQueue.create(logOutputChannel);

    context.subscriptions.push(

        commands.registerCommand(COMMAND_IDS.FORCE_FULL_REFRESH, () => {
            services.treeViewPanel.forceFullRefresh().catch((err) => {
                if (services.resourceStateCoordinator.disposed) { return; }
                window.showErrorMessage(String(err));
            });
        }),

        commands.registerCommand(COMMAND_IDS.GLOBAL_TASK_VIEW_OPEN_FIND_WIDGET, () => {
            void commands.executeCommand(`${GLOBAL_TREE_VIEW.ID}.focus`).then(
                () => commands.executeCommand('list.find'),
                () => { /* no-op */ }
            );
        }),

        commands.registerCommand(COMMAND_IDS.PROJECT_TASK_VIEW_OPEN_FIND_WIDGET, () => {
            void commands.executeCommand(`${PROJECT_TREE_VIEW.ID}.focus`).then(
                () => commands.executeCommand('list.find'),
                () => { /* no-op */ }
            );
        }),

        commands.registerCommand(COMMAND_IDS.GLOBAL_TASK_VIEW_EXPAND_ALL, () => {
            services.treeViewPanel.expandAllInView(GLOBAL_TREE_VIEW.ID);
        }),

        commands.registerCommand(COMMAND_IDS.PROJECT_TASK_VIEW_EXPAND_ALL, () => {
            services.treeViewPanel.expandAllInView(PROJECT_TREE_VIEW.ID);
        }),

        commands.registerCommand(COMMAND_IDS.GLOBAL_TASK_VIEW_COLLAPSE_ALL, () => {
            services.treeViewPanel.collapseAllInView(GLOBAL_TREE_VIEW.ID);
        }),

        commands.registerCommand(COMMAND_IDS.PROJECT_TASK_VIEW_COLLAPSE_ALL, () => {
            services.treeViewPanel.collapseAllInView(PROJECT_TREE_VIEW.ID);
        }),

        commands.registerCommand(COMMAND_IDS.OPEN_SETTINGS_FILTERING, () => {
            void commands.executeCommand(
                'workbench.action.openWorkspaceSettings', {
                query: `@ext:papio-dev.${ID} ${Object.values(SETTING_IDS.FILTERING).map((val) => `@id:${val}`).join(' ')}`
            }).then(undefined, () => { /* no-op */ });
        }),

        commands.registerCommand(COMMAND_IDS.OPEN_SETTINGS_DISPLAY, () => {
            void commands.executeCommand(
                'workbench.action.openWorkspaceSettings', {
                query: `@ext:papio-dev.${ID} ${Object.values(SETTING_IDS.DISPLAY).map((val) => `@id:${val}`).join(' ')}`
            }).then(undefined, () => { /* no-op */ });
        }),

        commands.registerCommand(COMMAND_IDS.OPEN_SETTINGS_EXCLUDE_FOLDERS, () => {
            void commands.executeCommand(
                'workbench.action.openWorkspaceSettings', {
                query: `@ext:papio-dev.${ID} @id:${SETTING_IDS.FILTERING.EXCLUDE_FOLDERS}`
            }).then(undefined, () => { /* no-op */ });
        }),


        // commands.registerCommand(COMMAND_IDS.TASKS_FILE_OPEN_WORKSPACE_TASKS, () => {
        //     // @todo открывать вручную, прокручивать к задачам?
        //     // нет, не нужно
        //     void commands.executeCommand('workbench.action.tasks.openWorkspaceFileTasks')
        //         .then(undefined, (_err) => { /* no-op */ });
        // }),

        commands.registerCommand(COMMAND_IDS.OPEN_HELP_PAGE, () => {
            const version = context.extension.packageJSON['version'] as string;
            void commands.executeCommand('vscode.open', Uri.from({
                scheme: 'https',
                authority: 'github.com',
                path: `/papio-dev/task-cockpit/tree/${version ? `v${version}` : 'main'}`,
                query: 'tab=readme-ov-file',
                fragment: 'configuration'
            }))
                .then(undefined, (_err) => { /* no-op */ });
        }),

        // kbd-bind+sub-menu
        // Открыть файл-задач User источника
        commands.registerCommand(COMMAND_IDS.OPEN_PROFILE_TASKS_FILE, () => {
            void commands.executeCommand('workbench.action.tasks.openUserTasks')
                .then(undefined, () => { /* no-op */ });
        }),

        // kbd-bind+sub-menu
        // Открыть в редакторе файл-источник задач текущей u/w/f-области
        commands.registerCommand(COMMAND_IDS.OPEN_PROJECT_TASKS_FILE, async (reason: Immutable<Element> | undefined) => {

            const element =
                reason
                    ? reason
                    : services.treeViewPanel.getSelection(PROJECT_TREE_VIEW.ID);

            if (!element) { return; } // если нет выделения

            try {

                const taskSource = await services.resourceStateCoordinator.resolveTaskSource(element.branchKey);

                assert.ok(taskSource);

                try {
                    return await commands.executeCommand('vscode.open', taskSource.uri);
                }
                catch (err) {
                    window.showErrorMessage(String(err));
                }
            }
            catch { /* no-op */ }

        }),


        // kbd-bind+sub-menu
        // Перейти к определению задачи в файле
        commands.registerCommand(COMMAND_IDS.OPEN_TASK_DEFINITION, async (reason: Immutable<Element> | undefined) => {

            const element =
                reason
                    ? reason
                    : services.treeViewPanel.getSelection(PROJECT_TREE_VIEW.ID);

            if (!element) { return; }// если нет выделения
            if (Element.isSynthetic(element)) { return; }
            if (element.data == null) { return; }

            try {

                const taskSource = await services.resourceStateCoordinator.resolveTaskSource(element.branchKey);
                if (!taskSource) { return; }

                try {
                    await openTaskDefinitionInEditor(taskSource, element.data.taskName);
                }
                catch (err) {
                    window.showErrorMessage(String(err));
                }

            }
            catch { /* no-op */ }

        }),

        // kbd-bind+sub-menu
        commands.registerCommand(COMMAND_IDS.TASK_EXECUTE_NEW_INSTANCE, (reason: unknown) => {

            // const treeElement = resolveTreeElement(reason, services.treeViewPanel);
            // if (!treeElement) { return; }

            // const taskNodeData = resolveNodeData(treeElement);
            // if (!taskNodeData) { return; }

            // if (!taskNodeData) { return; }

            // void commands.executeCommand(COMMAND_IDS.TASK_EXECUTE, { data: taskNodeData });

        }),

        // kbd-bind+sub-menu
        commands.registerCommand(COMMAND_IDS.TASK_ABORT_ALL_INSTANCES, (reason: unknown) => {

            // @fixme
            // const treeElement = resolveTreeElement(reason, services.treeViewPanel);
            // if (!treeElement) { return; }

            // const taskNodeData = resolveNodeData(treeElement);
            // if (!taskNodeData) { return; }


            // services.taskProcessLifecycle.terminateTaskProcesses(treeElement., taskName);
        }),


        // kbd-bind+sub-menu
        commands.registerCommand(COMMAND_IDS.TASK_SHOW_TERMINAL, (reason: unknown) => {

            // const treeElement = resolveTreeElement(reason, services.treeViewPanel);
            // if (!treeElement) { return; }

            // const taskNodeData = resolveNodeData(treeElement);
            // if (!taskNodeData) { return; }

            // void navigateToTerminal(taskNodeData, services.taskProcessLifecycle, logOutputChannel);
        }),


        commands.registerCommand(COMMAND_IDS.OPEN_BROKEN_TASK_DEFINITION, async (element: Immutable<Element.Runnable>) => {

            assert.ok(element.branchKey);
            assert.ok(element.data.taskName);

            try {

                const taskSource = await services.resourceStateCoordinator.resolveTaskSource(element.branchKey);

                if (!taskSource) {
                    await commands.executeCommand('workbench.action.tasks.openUserTasks')
                        .then(undefined, () => { /* no-op */ });
                    return;
                }

                try {
                    await openTaskDefinitionInEditor(taskSource, element.data.taskName);
                }
                catch (err) {
                    window.showErrorMessage(String(err));
                }

            }
            catch { /* no-op */ }
        }),

        commands.registerCommand(COMMAND_IDS.TASK_EXECUTE, async (element: Immutable<Element.Runnable>) => {

            assert.ok(element);
            assert.ok(element.branchKey);
            assert.ok(element.data);
            assert.ok(element.data.taskName);

            await taskExecQueue.enqueue(
                async () => {
                    try {
                        const { eligibleTask } = await services.resourceStateCoordinator.getTaskBundle(element.branchKey, element.data.taskName);
                        if (eligibleTask == null) { return; }
                        try {
                            await tasks.executeTask(eligibleTask as unknown as Task);
                        } catch (err) {
                            window.showErrorMessage(String(err));
                        }
                    }
                    catch { /* bo-op */ }
                }
            );
        }),

    );

}
