
import {
    commands,
    LogOutputChannel,
    Task,
    tasks,
    Uri,
    window
} from 'vscode';
import {
    EXTENSION,
    PROJECT_TREE,
    SETTING,
    USER_TREE
} from './common';
import * as assert from 'node:assert/strict';
import AsyncQueue from './utils/AsyncQueue';
import Element from './TreeViewPanel/TreeView/Element/Element';
import openTaskDefinitionInEditor from './TasksSource/openTaskDefinitionInEditor';
import Services from './extension/Services';
import showPickTerminal from './extension/showPickTerminal';

import {
    type ExtensionContext,
} from 'vscode';
import type Immutable from './utils/Immutable';


let logOutputChannel: LogOutputChannel;

export async function activate(context: ExtensionContext): Promise<void> {

    const extDisplayName = context.extension.packageJSON['displayName'] as string;
    logOutputChannel = window.createOutputChannel(extDisplayName, { log: true });

    try {
        const services = await Services.create(extDisplayName, 30_000, logOutputChannel);

        context.subscriptions.push(
            services
        );

        registerCommands(context, services, logOutputChannel);

        // первое обновление — начало работы
        services.resourceStateCoordinator!.forceFullRefresh();

    }
    catch (err) {
        window.showErrorMessage(String(err));
    }

}

export function deactivate(): void {
    logOutputChannel.dispose();
}


function registerCommands(
    context: ExtensionContext,
    services: Readonly<Services>,
    logOutputChannel: LogOutputChannel
) {

    const asyncQueue = AsyncQueue.create(logOutputChannel);

    async function runTaskHandler(element: Immutable<Element.Runnable>) {

        await asyncQueue.enqueue(
            async () => {
                try {
                    const taskBundle = await services.resourceStateCoordinator?.getTaskBundle(element.branchKey, element.data.taskName);
                    const eligibleTask = taskBundle?.eligibleTask;
                    if (!eligibleTask) { return; }
                    try {
                        await tasks.executeTask(eligibleTask as unknown as Task);
                    } catch (err) {
                        window.showErrorMessage(String(err));
                    }
                }
                catch (err) {
                    // @todo
                }
            }
        );
    }

    function abortAllInstancesHandler(element: Immutable<Element.Runnable>) {
        services.taskProcessLifecycle?.terminateTaskProcesses(element.branchKey, element.data.taskName);
    }

    async function navigateToTerminalHandler(element: Immutable<Element.Runnable>) {

        try {
            const taskProcesses = await services.taskProcessLifecycle?.getTaskProcessRecords(element.branchKey, element.data.taskName);

            if (!taskProcesses) { return; }
            if (taskProcesses.length < 1) { return; }

            if (taskProcesses.length === 1) {
                taskProcesses.at(0)!.terminalRef.deref()?.show();
                return;
            }

            const terminalRef = await showPickTerminal(element.data.taskLabel, taskProcesses);

            terminalRef?.deref()?.show();

        }
        catch (err) {
            /* no-op */
        }

    }

    context.subscriptions.push(

        commands.registerCommand(EXTENSION.COMMAND.FULL_REFRESH.ID, async () => {

            try {
                await services.resourceStateCoordinator?.forceFullRefresh();
            }
            catch (err) {
                window.showErrorMessage(String(err));
            }

        }),

        commands.registerCommand(EXTENSION.COMMAND.FULL_REFRESH__SPINNER.ID, () => { }),

        commands.registerCommand(USER_TREE.COMMAND.LIST_FIND.ID, async () => {
            try {
                await commands.executeCommand(`${USER_TREE.ID}.focus`);
                await commands.executeCommand('list.find');
            }
            catch (err) {
                /* no-op */
            }
        }),

        commands.registerCommand(PROJECT_TREE.COMMAND.LIST_FIND.ID, async () => {
            try {
                await commands.executeCommand(`${PROJECT_TREE.ID}.focus`);
                await commands.executeCommand('list.find');
            }
            catch (err) {
                /* no-op */
            }
        }),

        commands.registerCommand(USER_TREE.COMMAND.LIST_EXPAND_ALL.ID, () => {
            services.globalTreeView?.expandAll();
        }),

        commands.registerCommand(PROJECT_TREE.COMMAND.LIST_EXPAND_ALL.ID, () => {
            services.projectTreeView?.expandAll();
        }),

        commands.registerCommand(USER_TREE.COMMAND.LIST_COLLAPSE_ALL.ID, () => {
            services.globalTreeView?.collapseAll();
        }),

        commands.registerCommand(PROJECT_TREE.COMMAND.LIST_COLLAPSE_ALL.ID, () => {
            services.projectTreeView?.collapseAll();
        }),

        commands.registerCommand(EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__USR.ID, async () => {
            try {
                await commands.executeCommand(
                    'workbench.action.openGlobalSettings', {
                    query: `@ext:papio-dev.${EXTENSION.ID} ${Object.values(SETTING.FILTERING).map((val) => `@id:${val}`).join(' ')}`
                });
            }
            catch (err) {
                /* no-op */
            }
        }),

        commands.registerCommand(EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__WS.ID, async () => {
            try {
                await commands.executeCommand(
                    'workbench.action.openWorkspaceSettings', {
                    query: `@ext:papio-dev.${EXTENSION.ID} ${Object.values(SETTING.FILTERING).map((val) => `@id:${val}`).join(' ')}`
                });
            }
            catch (err) {
                /* no-op */
            }
        }),

        commands.registerCommand(EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__USR.ID, async () => {
            try {
                await commands.executeCommand(
                    'workbench.action.openGlobalSettings', {
                    query: `@ext:papio-dev.${EXTENSION.ID} ${Object.values(SETTING.DISPLAY).map((val) => `@id:${val}`).join(' ')}`
                });
            }
            catch (err) {
                /* no-op */
            }
        }),

        commands.registerCommand(EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__WS.ID, async () => {
            try {
                await commands.executeCommand(
                    'workbench.action.openWorkspaceSettings', {
                    query: `@ext:papio-dev.${EXTENSION.ID} ${Object.values(SETTING.DISPLAY).map((val) => `@id:${val}`).join(' ')}`
                });
            }
            catch (err) {
                /* no-op */
            }
        }),

        commands.registerCommand(EXTENSION.COMMAND.OPEN_SETTINGS_EXCLUDE_FOLDERS.ID, async () => {
            try {
                await commands.executeCommand(
                    'workbench.action.openWorkspaceSettings', {
                    query: `@ext:papio-dev.${EXTENSION.ID} @id:${SETTING.FILTERING.EXCLUDE_FOLDERS}`
                });
            }
            catch (err) {
                /* no-op */
            }
        }),

        commands.registerCommand(EXTENSION.COMMAND.OPEN_HELP_PAGE.ID, async () => {
            const version = context.extension.packageJSON['version'] as string;
            try {
                await commands.executeCommand('vscode.open', Uri.from({
                    scheme: 'https',
                    authority: 'github.com',
                    path: `/papio-dev/task-cockpit/tree/${version ? `v${version}` : 'main'}`,
                    query: 'tab=readme-ov-file',
                    fragment: 'configuration'
                }));
            }
            catch (err) {
                /* no-op */
            }
        }),

        // kbd-bind+sub-menu
        // Открыть файл-задач User источника
        commands.registerCommand(USER_TREE.COMMAND.OPEN_USER_TASKS.ID, async () => {
            try {
                await commands.executeCommand('workbench.action.tasks.openUserTasks');
            }
            catch (err) {
                /* no-op */
            }
        }),

        // kbd-bind+sub-menu
        commands.registerCommand(USER_TREE.COMMAND.OPEN_USER_TASKS__BROKEN.ID, async () => {
            await commands.executeCommand(USER_TREE.COMMAND.OPEN_USER_TASKS.ID);
        }),

        // kbd-bind+sub-menu
        // Открыть в редакторе файл-источник задач текущей u/w/f-области
        commands.registerCommand(PROJECT_TREE.COMMAND.OPEN_TASKS_FILE.ID, async (reason: Immutable<Element> | undefined) => {

            const element =
                reason
                    ? reason
                    : services.projectTreeView?.getSelection();

            if (!element) { return; } // если нет выделения

            try {

                const taskSource = await services.resourceStateCoordinator?.resolveTaskSource(element.branchKey);

                if (!taskSource) { return; };

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
        commands.registerCommand(PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.ID, async (reason: Immutable<Element> | undefined) => {

            const element =
                reason
                    ? reason
                    : services.projectTreeView?.getSelection();

            if (!element) { return; }// если нет выделения
            if (Element.isSynthetic(element)) { return; }
            if (!Element.isRunnable(element)) { return; }

            try {

                const taskSource = await services.resourceStateCoordinator?.resolveTaskSource(element.branchKey);

                if (!taskSource) { return; };

                try {
                    await openTaskDefinitionInEditor(taskSource, element.data.taskName);
                }
                catch (err) {
                    window.showErrorMessage(String(err));
                }

            }
            catch (err) {
                if (err instanceof assert.AssertionError) {
                    window.showErrorMessage(String(err));
                }
                // остальные no-op
            }

        }),

        commands.registerCommand(PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION__BROKEN.ID, async (element: Immutable<Element.Runnable>) => {
            await commands.executeCommand(PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.ID, element);
        }),

        // -------------
        commands.registerCommand(USER_TREE.COMMAND.TASK_RUN_INLINE.ID, async (element: Immutable<Element>) => {
            await commands.executeCommand(USER_TREE.COMMAND.TASK_RUN.ID, element);
        }),

        // -------------
        commands.registerCommand(PROJECT_TREE.COMMAND.TASK_RUN_INLINE.ID, async (element: Immutable<Element.Runnable>) => {
            await commands.executeCommand(PROJECT_TREE.COMMAND.TASK_RUN.ID, element);
        }),

        // kbd-bind+sub-menu
        commands.registerCommand(USER_TREE.COMMAND.TASK_RUN.ID, async (reason: Immutable<Element> | undefined) => {

            const element =
                reason
                    ? reason
                    : services.globalTreeView?.getSelection();

            if (!element) { return; }// если нет выделения

            if (Element.isSynthetic(element)) { return; }
            if (!Element.isRunnable(element)) { return; }

            await runTaskHandler(element);
        }),

        commands.registerCommand(PROJECT_TREE.COMMAND.TASK_RUN.ID, async (reason: Immutable<Element> | undefined) => {

            const element =
                reason
                    ? reason
                    : services.projectTreeView?.getSelection();

            if (!element) { return; }// если нет выделения

            if (Element.isSynthetic(element)) { return; }
            if (!Element.isRunnable(element)) { return; }

            await runTaskHandler(element);
        }),

        // kbd-bind+sub-menu
        commands.registerCommand(USER_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID, (reason: Immutable<Element> | undefined) => {

            const element =
                reason
                    ? reason
                    : services.globalTreeView?.getSelection();

            if (!element) { return; }// если нет выделения
            if (Element.isSynthetic(element)) { return; }
            if (!Element.isRunnable(element)) { return; }

            abortAllInstancesHandler(element);
        }),

        commands.registerCommand(PROJECT_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID, (reason: Immutable<Element> | undefined) => {

            const element =
                reason
                    ? reason
                    : services.projectTreeView?.getSelection();

            if (!element) { return; }// если нет выделения
            if (Element.isSynthetic(element)) { return; }
            if (!Element.isRunnable(element)) { return; }

            abortAllInstancesHandler(element);
        }),

        // kbd-bind+sub-menu
        commands.registerCommand(USER_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID, async (reason: Immutable<Element> | undefined) => {

            const element =
                reason
                    ? reason
                    : services.globalTreeView?.getSelection();

            if (!element) { return; }// если нет выделения
            if (Element.isSynthetic(element)) { return; }
            if (!Element.isRunnable(element)) { return; }

            await navigateToTerminalHandler(element);
        }),

        commands.registerCommand(PROJECT_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID, async (reason: Immutable<Element> | undefined) => {

            const element =
                reason
                    ? reason
                    : services.projectTreeView?.getSelection();

            if (!element) { return; }// если нет выделения
            if (Element.isSynthetic(element)) { return; }
            if (!Element.isRunnable(element)) { return; }

            await navigateToTerminalHandler(element);
        }),

    );

}
