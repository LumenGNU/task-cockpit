
import {
    Disposable,
    window,
    LogOutputChannel,
    type ExtensionContext,
    commands,
    extensions,
    Uri,
    tasks,
    Task
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
import TaskSource from './ResourceStateCoordinator/TaskSource';
import TaskName from './TaskName';
import TaskNodeData from './TreeViewPanel/TaskNodeData';
import OriginKey from './OriginKey';
import AsyncQueue from './utils/AsyncQueue';


let logOutputChannel: LogOutputChannel;

export async function activate(context: ExtensionContext): Promise<void> {

    const extDisplayName = context.extension.packageJSON['displayName'];

    logOutputChannel = window.createOutputChannel(extDisplayName, { log: true });

    const windowSettings = new WindowSettings(logOutputChannel);
    const resourceStateCoordinator = await ResourceStateCoordinator.create(5_000, logOutputChannel);

    const resourceProps = { windowSettings, resourceStateCoordinator };

    const taskProcessLifecycle = new TaskProcessLifecycle(resourceProps, logOutputChannel);
    const fileDecorationProvider = new FileDecorationProvider(resourceProps, logOutputChannel);
    const diagnosticsManager = new DiagnosticsManager(extDisplayName, resourceProps, logOutputChannel);

    const treeViewPanel = new TreeViewPanel(
        resourceProps,
        taskProcessLifecycle.taskProcessRegistry,
        logOutputChannel
    );

    context.subscriptions.push(
        treeViewPanel,
        diagnosticsManager,
        window.registerFileDecorationProvider(fileDecorationProvider),
        fileDecorationProvider,
        taskProcessLifecycle,
        resourceStateCoordinator,
        windowSettings,
    );

    registerCommands(context, resourceProps, taskProcessLifecycle, treeViewPanel, logOutputChannel);

}

export function deactivate(): void {
    logOutputChannel.dispose();
}


function registerCommands(
    context: ExtensionContext,
    resourceProps: {
        windowSettings: WindowSettings;
        resourceStateCoordinator: ResourceStateCoordinator;
    },
    taskProcessLifecycle: TaskProcessLifecycle,
    panel: TreeViewPanel,
    logOutputChannel: LogOutputChannel
) {

    const taskQueue = AsyncQueue.create(logOutputChannel);

    context.subscriptions.push(

        commands.registerCommand(COMMAND_IDS.FORCE_FULL_REFRESH, () => {
            panel.forceFullRefresh().catch((err) => {
                if (resourceProps.resourceStateCoordinator.disposed) { return; }
                window.showErrorMessage(String(err));
            });
        }),

        commands.registerCommand(COMMAND_IDS.GLOBAL_TASK_VIEW_OPEN_FIND_WIDGET, () => {
            void commands.executeCommand(`${GLOBAL_TREE_VIEW.ID}.focus`).then(
                () => commands.executeCommand('list.find'),
                () => { /* no-op */ },
            );
        }),

        commands.registerCommand(COMMAND_IDS.PROJECT_TASK_VIEW_OPEN_FIND_WIDGET, () => {
            void commands.executeCommand(`${PROJECT_TREE_VIEW.ID}.focus`).then(
                () => commands.executeCommand('list.find'),
                () => { /* no-op */ },
            );
        }),

        commands.registerCommand(COMMAND_IDS.GLOBAL_TASK_VIEW_EXPAND_ALL, () => {
            panel.expandAllInView(GLOBAL_TREE_VIEW.ID);
        }),

        commands.registerCommand(COMMAND_IDS.PROJECT_TASK_VIEW_EXPAND_ALL, () => {
            panel.expandAllInView(PROJECT_TREE_VIEW.ID);
        }),

        commands.registerCommand(COMMAND_IDS.GLOBAL_TASK_VIEW_COLLAPSE_ALL, () => {
            panel.collapseAllInView(GLOBAL_TREE_VIEW.ID);
        }),

        commands.registerCommand(COMMAND_IDS.PROJECT_TASK_VIEW_COLLAPSE_ALL, () => {
            panel.collapseAllInView(PROJECT_TREE_VIEW.ID);
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

        commands.registerCommand(COMMAND_IDS.TASKS_FILE_OPEN_USER_TASKS, () => {
            void commands.executeCommand('workbench.action.tasks.openUserTasks')
                .then(undefined, () => { /* no-op */ });
        }),

        commands.registerCommand(COMMAND_IDS.TASKS_FILE_OPEN_WORKSPACE_TASKS, () => {
            // @todo открывать вручную, прокручивать к задачам?
            // нет, не нужно
            void commands.executeCommand('workbench.action.tasks.openWorkspaceFileTasks')
                .then(undefined, () => { /* no-op */ });
        }),

        commands.registerCommand(COMMAND_IDS.TASKS_FILE_OPEN_TASKS_FILE, (element: unknown) => {
            if (
                element != null
                && typeof element === 'object'
                && 'resourceUri' in element
                && element.resourceUri instanceof Uri
            ) {
                return void commands.executeCommand('vscode.open', element.resourceUri);
            }
            logOutputChannel.warn('[Command#openTasksFile] No resourceUri on element:', element);
        }),

        commands.registerCommand(COMMAND_IDS.OPEN_HELP_PAGE, () => {
            const version = extensions.getExtension(context.extension.packageJSON.version);
            void commands.executeCommand('vscode.open', Uri.from({
                scheme: 'https',
                authority: 'github.com',
                path: `/papio-dev/task-cockpit/tree/${version ? `v${version}` : 'main'}`,
                query: 'tab=readme-ov-file',
                fragment: 'configuration'
            })).then(undefined, () => { /* no-op */ });
        }),

        commands.registerCommand(COMMAND_IDS.TASKS_FILE_OPEN_TASK, (element: unknown) => {
            const taskNodeData = getTaskNodeData(element);
            if (!taskNodeData) {
                return;
            }
            const { taskSource, taskName } = taskNodeData;
            if (!taskSource) {
                // @todo user msg?
                return;
            }
            void openTaskDefinitionInEditor(taskSource, taskName).catch((err) => {
                window.showErrorMessage(String(err));
            });
        }),

        commands.registerCommand(COMMAND_IDS.TASK_EXECUTE, (element: unknown) => {
            const taskNodeData = getTaskNodeData(element);
            if (!taskNodeData) { return; }
            logOutputChannel.trace(`[task-cockpit.task.execute] Execute task`);
            logOutputChannel.trace(`    - Origin : ${OriginKey.resolveOriginName(taskNodeData.taskOrigin)}`);
            logOutputChannel.trace(`    - Task   : ${taskNodeData.taskLabel}`);

            void resourceProps.resourceStateCoordinator
                .getTaskBundle(taskNodeData.taskOrigin, taskNodeData.taskName).then(
                    (taskBundle) => {
                        if (taskBundle.eligibleTask == null) { return; }

                        taskQueue.enqueue(() => {
                            return tasks.executeTask(taskBundle.eligibleTask as any)
                                .then(undefined, (err) => {
                                    window.showErrorMessage(String(err));
                                });
                        });

                    },
                    (_err) => { /* bo-op */ }
                );
        })
    );

}


function getTaskNodeData(element: unknown): TaskNodeData | null {

    if (!(element != null && typeof element === 'object')) {
        return null;
    }

    if (!('data' in element)) {
        return null;
    }

    if (!TaskNodeData.isTaskNodeData(element.data)) {
        return null;
    }

    return element.data;
}
