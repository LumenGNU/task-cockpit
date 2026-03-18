import * as vscode from 'vscode';
import Cockpit from './Cockpit';
import DecorationProviders from './DecorationProviders';
import Runtime from './Runtime';
import TasksFile from './TasksFile';
import Workspace from './Workspace';
import helpers from './helpers';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from './Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


export async function activate(context: vscode.ExtensionContext) {

    // #region DEBUG
    {
        log(LogLevel.Debug, '* * * * *');
        log(LogLevel.Debug, `Extension "${context.extension.id}" activate`);
        // Среда VS Code
        log(LogLevel.Debug, `App: ${vscode.env.appName} (${vscode.env.appHost}), version ${vscode.version}`);
        log(LogLevel.Debug, `Language: ${vscode.env.language}`);
        log(LogLevel.Debug, `UI Kind: ${vscode.env.uiKind === vscode.UIKind.Desktop ? 'Desktop' : 'Web'}`);

        // Workspace
        log(LogLevel.Debug, `Workspace file: ${vscode.workspace.workspaceFile?.fsPath ?? 'none'}`);

    }
    // #endregion DEBUG



    { // diagnosticsManager

        const configuration = vscode.workspace
            .getConfiguration('taskCockpit');

        const checkers = [];

        if (configuration.get<boolean>('validation.duplicateLabels', false)) {
            checkers.push(TasksFile.Checkers.duplicates);
        }

        if (configuration.get<boolean>('validation.dependencies', false)) {
            checkers.push(TasksFile.Checkers.dependencies);
        }

        if (checkers.length > 0) {
            const diagnosticsManager = new TasksFile.DiagnosticsManager(checkers);
            context.subscriptions.push(diagnosticsManager);
        }

    }

    const runtime = new Runtime();
    const workspace = new Workspace();

    const cockpit = await Cockpit.create(runtime, workspace);


    context.subscriptions.push(

        cockpit,
        runtime,
        workspace,

        // #region DEBUG
        vscode.commands.registerCommand('task-cockpit.DEBUG', async function () {

            const msg = await vscode.window.showInputBox();

            log(LogLevel.Debug,
                '---DEBUG---');

            if (msg) {
                log(LogLevel.Debug,
                    msg);
            }

        }),

        vscode.commands.registerCommand('task-cockpit.DEBUG.print-node', function (node?: Cockpit.Node) {

            // log(LogLevel.Debug,
            //     `NODE: ${JSON.stringify(node, null, 2)}`);



            log(LogLevel.Debug,
                `TREE_ITEM: ${node ? JSON.stringify(cockpit.getTreeItem(node), null, 2) : '-- No node received --'}`);


        }),
        // #endregion DEBUG



        // - - - - -

        vscode.commands.registerCommand('_task-cockpit.tasks-file.open-tasks-file', async function (node?: Cockpit.Node) {
            await vscode.commands.executeCommand('task-cockpit.tasks-file.open-file', node);
        }),

        vscode.commands.registerCommand('_task-cockpit.tasks-file.open-workspace-file', async function (node?: Cockpit.Node) {
            await vscode.commands.executeCommand('task-cockpit.tasks-file.open-file', node);
        }),


        vscode.commands.registerCommand('task-cockpit.tasks-file.open-file', async function (node?: Cockpit.Node) {

            const taskFile = cockpit.resolveTaskFile(node);

            if (!taskFile) {
                return;
            }

            await vscode.commands.executeCommand('task-cockpit.tasks-file.open-file',);

            const uri = vscode.Uri.file(taskFile);

            await vscode.commands.executeCommand('vscode.open', uri);

        }),


        vscode.commands.registerCommand('task-cockpit.tasks-file.open-task', async function (node?: Cockpit.Node) {

            // #region DEBUG
            const commandId = 'tasks-file.open-task';
            log(LogLevel.Debug, 'Command invoked', commandId);
            // #endregion DEBUG

            const taskId = cockpit.resolveTaskId(node);

            if (!taskId) {
                // #region DEBUG
                log(LogLevel.Debug, 'No task ID resolved. Command finished', commandId);
                // #endregion DEBUG
                return;
            }

            try {
                await TasksFile.openTask(taskId);
            }
            catch (error) {

                if (error instanceof TasksFile.openTask.StaleDefinitionError) {
                    const { taskFile, taskName } = helpers.parseId(error.taskId);
                    const relative = vscode.workspace.asRelativePath(taskFile);
                    await vscode.window.showWarningMessage(`Task "${taskName}" not found — file "${relative}" has unsaved changes`);
                }

                // #region DEBUG
                log(LogLevel.Error, `Failed to open task. Task ID: ${helpers.printTaskId(taskId)}, Error: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
                const cause = error instanceof Error ? error.cause : undefined;
                if (cause) {
                    log(LogLevel.Error, `Failed to open task. Task ID: ${helpers.printTaskId(taskId)}, Cause: ${cause instanceof Error ? cause.message : JSON.stringify(cause)}`);
                }
                // #endregion DEBUG
            }

            // #region DEBUG
            log(LogLevel.Debug, 'Command finished', commandId);
            // #endregion DEBUG
        }),


        // Не доступно для шорт-ката
        vscode.commands.registerCommand('_task-cockpit.task.execute', async function (node?: Cockpit.Node) {

            // #region DEBUG
            const commandId = 'tasks-file.task.execute';
            log(LogLevel.Debug, 'Command invoked', commandId);
            // #endregion DEBUG

            const taskId = cockpit.resolveTaskId(node);

            if (!taskId) {
                // #region DEBUG
                log(LogLevel.Debug, 'No task found in workspace. Command finished', commandId);
                // #endregion DEBUG
                return;
            }

            try {

                await vscode.tasks.executeTask(workspace.getTask(taskId)!.vscTask);

                // #region DEBUG
                log(LogLevel.Debug,
                    `Task executed. Task ID: ${helpers.printTaskId(taskId)}`, commandId);
                // #endregion DEBUG
            }
            catch (error) {

                // When running a ShellExecution or a ProcessExecution task in an environment where a
                // new process cannot be started. In such an environment, only CustomExecution tasks
                // can be run.
                // Не ошибка — попытка запуска задачи в не доверенном окружении

                // #region DEBUG
                log(LogLevel.Warning,
                    `Task execute failed: Task ID: ${helpers.printTaskId(taskId)}. With error: ${error instanceof Error ? error.message : JSON.stringify(error)}`, commandId);
                // #endregion DEBUG

                // @fixme: vscode сама покажет проблему?
                // await vscode.window.showErrorMessage(`Task executed failed "${helpers.printTaskId(helpers.resolveId(task))}": ${error instanceof Error ? error.message : JSON.stringify(error)}`);
            }

            // #region DEBUG
            log(LogLevel.Debug, 'Command finished', commandId);
            // #endregion DEBUG

        }),


        // Команда "Запустить новый экземпляр задачи" — это та же "Запустить задачу", просто
        // в другом контексте.
        //
        // @todo: Доступно для шорт-ката
        vscode.commands.registerCommand('task-cockpit.task.execute', async function (node?: Cockpit.Node) {
            await vscode.commands.executeCommand('_task-cockpit.task.execute', node);
        }),


        vscode.commands.registerCommand('task-cockpit.task.abort-all', function (node?: Cockpit.Node) {

            // #region DEBUG
            const commandId = 'tasks-file.task.abort-all';
            log(LogLevel.Debug, 'Command invoked', commandId);
            // #endregion DEBUG

            const taskId = cockpit.resolveTaskId(node);

            if (!taskId) {
                // #region DEBUG
                log(LogLevel.Debug, 'No task ID resolved. Command finished', commandId);
                // #endregion DEBUG
                return;
            }

            runtime.abortAll(taskId);

            // #region DEBUG
            log(LogLevel.Debug, 'Command finished', commandId);
            // #endregion DEBUG
        }),


        vscode.commands.registerCommand('task-cockpit.task.show-terminal', async function (node?: Cockpit.Node) {
            // #region DEBUG
            const commandId = 'tasks-file.task.show-terminal';
            log(LogLevel.Debug, 'Command invoked', commandId);
            // #endregion DEBUG
            const taskId = cockpit.resolveTaskId(node);
            if (!taskId) {
                // #region DEBUG
                log(LogLevel.Debug, 'No task ID resolved. Command finished', commandId);
                // #endregion DEBUG
                return;
            }
            const terminalsMap = await runtime.getTerminals(taskId);
            if (terminalsMap.size === 0) {
                // #region DEBUG
                log(LogLevel.Debug, 'No terminals found. Command finished', commandId);
                // #endregion DEBUG
                return;
            }
            let terminal: vscode.Terminal;
            if (terminalsMap.size === 1) {
                terminal = terminalsMap.keys().next().value!;
            } else {
                const items = [...terminalsMap].map(([terminal, info]) => ({
                    label: `Process ID: ${info.processId}`,
                    iconPath: new vscode.ThemeIcon('terminal'),
                    description: info.running ? 'running' : 'completed',
                    detail: new Date(info.timestamp).toLocaleString(vscode.env.language),
                    // @todo не работает
                    // picked: vscode.window.activeTerminal === terminal,
                    terminal
                }));
                const picked = await vscode.window.showQuickPick(items, {
                    title: cockpit.printNodePath(node!),
                    placeHolder: 'Select terminal',
                    matchOnDescription: true,
                    matchOnDetail: true,
                });
                if (!picked) {
                    // #region DEBUG
                    log(LogLevel.Debug, 'No terminal selected. Command finished', commandId);
                    // #endregion DEBUG
                    return;
                }
                terminal = picked.terminal;
            }
            terminal.show();
            // #region DEBUG
            log(LogLevel.Debug, 'Command finished', commandId);
            // #endregion DEBUG
        }),

        // Обновить дерево(я)
        vscode.commands.registerCommand('task-cockpit.view.refresh', cockpit.rebuild, cockpit),


        vscode.commands.registerCommand('task-cockpit.settings.configure-display', function () {
            return vscode.commands.executeCommand(
                'workbench.action.openWorkspaceSettings',
                { query: '@ext:papio-dev.task-cockpit taskCockpit.display' });
        }),


        vscode.commands.registerCommand('task-cockpit.settings.configure-filtering', function () {
            return vscode.commands.executeCommand(
                'workbench.action.openWorkspaceSettings',
                { query: '@ext:papio-dev.task-cockpit taskCockpit.filtering' });
        }),


        vscode.commands.registerCommand('task-cockpit.open-help-page', function () {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.from({
                scheme: 'https',
                authority: 'github.com',
                path: '/papio-dev/task-cockpit/tree/main',
                query: 'tab=readme-ov-file',
                fragment: 'configuration'
            }));
        }),
    );

    // бейджи и декораторы
    context.subscriptions.push(
        vscode.window.registerFileDecorationProvider(new DecorationProviders.Processes()),
        vscode.window.registerFileDecorationProvider(new DecorationProviders.Color())
    );
}


export function deactivate() {

    // #region DEBUG
    Logger.dispose();
    // #endregion DEBUG

}
