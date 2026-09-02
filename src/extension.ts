
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
} from 'vscode';
import {
    USER_TREE,
    EXTENSION,
    PROJECT_TREE,
    SETTING,
    CONTAINER
} from './common';
import openTaskDefinitionInEditor from './TasksSource/openTaskDefinitionInEditor';
import AsyncQueue from './utils/AsyncQueue';
import Services from './extension/Services';
import Element from './TreeViewPanel/TreeView/Element/Element';
import type Immutable from './utils/Immutable';
import * as assert from 'node:assert/strict';
import type TaskProcessRecord from './Runtime/TaskProcessRecord';


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

    async function runTaskHandler(reason: Immutable<Element> | undefined, treeViewId: typeof USER_TREE.ID | typeof PROJECT_TREE.ID) {

        const element =
            reason
                ? reason
                : services.treeViewPanel.getSelection(treeViewId);

        if (!element) { return; }// если нет выделения
        if (Element.isSynthetic(element)) { return; }
        if (!Element.isRunnable(element)) { return; }

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
                catch (err) {
                    if (services.resourceStateCoordinator.isInoperable) { return; }
                    window.showErrorMessage(String(err));
                }
            }
        );
    }

    function abortAllInstancesHandler(reason: Immutable<Element> | undefined, treeViewId: typeof USER_TREE.ID | typeof PROJECT_TREE.ID) {

        const element =
            reason
                ? reason
                : services.treeViewPanel.getSelection(treeViewId);

        if (!element) { return; }// если нет выделения
        if (Element.isSynthetic(element)) { return; }
        if (!Element.isRunnable(element)) { return; }

        services.taskProcessLifecycle.terminateTaskProcesses(element.branchKey, element.data.taskName);

    }

    async function navigateToTerminalHandler(reason: Immutable<Element> | undefined, treeViewId: typeof USER_TREE.ID | typeof PROJECT_TREE.ID) {

        const element =
            reason
                ? reason
                : services.treeViewPanel.getSelection(treeViewId);

        if (!element) { return; }// если нет выделения
        if (Element.isSynthetic(element)) { return; }
        if (!Element.isRunnable(element)) { return; }

        try {
            const taskProcesses = await services.taskProcessLifecycle.getTaskProcessRecords(element.branchKey, element.data.taskName);


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

        commands.registerCommand(CONTAINER.COMMAND.FULL_REFRESH.ID, async () => {
            try {
                await services.treeViewPanel.forceFullRefresh();
            }
            catch (err) {
                if (services.treeViewPanel.isInoperable) { return; }
                window.showErrorMessage(String(err));
            }
        }),

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
            services.treeViewPanel.expandAllInView(USER_TREE.ID);
        }),

        commands.registerCommand(PROJECT_TREE.COMMAND.LIST_EXPAND_ALL.ID, () => {
            services.treeViewPanel.expandAllInView(PROJECT_TREE.ID);
        }),

        commands.registerCommand(USER_TREE.COMMAND.LIST_COLLAPSE_ALL.ID, () => {
            services.treeViewPanel.collapseAllInView(USER_TREE.ID);
        }),

        commands.registerCommand(PROJECT_TREE.COMMAND.LIST_COLLAPSE_ALL.ID, () => {
            services.treeViewPanel.collapseAllInView(PROJECT_TREE.ID);
        }),

        commands.registerCommand(EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS.ID, async () => {
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

        commands.registerCommand(EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS.ID, async () => {
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
                    : services.treeViewPanel.getSelection(PROJECT_TREE.ID);

            if (!element) { return; } // если нет выделения

            assert.ok('branchKey' in element);

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
        commands.registerCommand(PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.ID, async (reason: Immutable<Element> | undefined) => {

            const element =
                reason
                    ? reason
                    : services.treeViewPanel.getSelection(PROJECT_TREE.ID);

            if (!element) { return; }// если нет выделения
            if (Element.isSynthetic(element)) { return; }
            if (!Element.isRunnable(element)) { return; }

            try {

                const taskSource = await services.resourceStateCoordinator.resolveTaskSource(element.branchKey);
                assert.ok(taskSource);

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

            assert.ok(element);
            assert.ok(!Element.isSynthetic(element));
            assert.ok(Element.isRunnable(element));

            await commands.executeCommand(PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.ID, element);
        }),

        // -------------
        commands.registerCommand(USER_TREE.COMMAND.TASK_RUN_INLINE.ID, async (element: Immutable<Element>) => {

            assert.ok(element);
            assert.ok(!Element.isSynthetic(element));
            assert.ok(Element.isRunnable(element));

            commands.executeCommand(USER_TREE.COMMAND.TASK_RUN.ID, element);

        }),

        // -------------
        commands.registerCommand(PROJECT_TREE.COMMAND.TASK_RUN_INLINE.ID, async (element: Immutable<Element.Runnable>) => {

            assert.ok(element);
            assert.ok(element.branchKey);
            assert.ok(element.data);
            assert.ok(element.data.taskName);

            commands.executeCommand(PROJECT_TREE.COMMAND.TASK_RUN.ID, element);
        }),


        // kbd-bind+sub-menu
        commands.registerCommand(USER_TREE.COMMAND.TASK_RUN.ID, async (reason: Immutable<Element> | undefined) => {
            await runTaskHandler(reason, USER_TREE.ID);
        }),

        commands.registerCommand(PROJECT_TREE.COMMAND.TASK_RUN.ID, async (reason: Immutable<Element> | undefined) => {
            await runTaskHandler(reason, PROJECT_TREE.ID);
        }),

        // kbd-bind+sub-menu
        commands.registerCommand(USER_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID, (reason: Immutable<Element> | undefined) => {
            abortAllInstancesHandler(reason, USER_TREE.ID);
        }),

        commands.registerCommand(PROJECT_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID, (reason: Immutable<Element> | undefined) => {
            abortAllInstancesHandler(reason, PROJECT_TREE.ID);
        }),


        // kbd-bind+sub-menu
        commands.registerCommand(USER_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID, async (reason: Immutable<Element> | undefined) => {
            await navigateToTerminalHandler(reason, USER_TREE.ID);
        }),

        commands.registerCommand(PROJECT_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID, async (reason: Immutable<Element> | undefined) => {
            await navigateToTerminalHandler(reason, PROJECT_TREE.ID);
        }),

    );

}


async function showPickTerminal(
    taskLabel: string,
    taskProcesses: Immutable<Array<TaskProcessRecord>>
) {

    const iconPath = new ThemeIcon('terminal');

    const items = taskProcesses.map((taskProcess) => ({
        label: `Process ID: ${taskProcess.taskProcessId}`,
        iconPath,
        description: taskProcess.running ? 'running' : 'completed',
        detail: new Date(taskProcess.timestamp).toLocaleString(env.language),
        terminalRef: taskProcess.terminalRef
    }));

    return (await window.showQuickPick(items, {
        title: taskLabel,
        placeHolder: 'Select terminal',
        matchOnDescription: true,
        matchOnDetail: true
    }))?.terminalRef;
}
