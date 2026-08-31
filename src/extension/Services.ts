import {
    type ExtensionContext,
    type LogOutputChannel
} from 'vscode';
import WindowSettings from '../WindowSettings/WindowSettings';
import ResourceStateCoordinator from '../ResourceStateCoordinator/ResourceStateCoordinator';
import TaskProcessLifecycle from '../Runtime/TaskProcessLifecycle';
import FileDecorationProvider from '../FileDecorationProvider/FileDecorationProvider';
import DiagnosticsManager from '../TasksSource/Diagnostics/DiagnosticsManager';
import TreeViewPanel from '../TreeViewPanel/TreeViewPanel';


interface Services {
    diagnosticsManager: DiagnosticsManager;
    fileDecorationProvider: FileDecorationProvider;
    resourceStateCoordinator: ResourceStateCoordinator;
    taskProcessLifecycle: TaskProcessLifecycle;
    treeViewPanel: TreeViewPanel;
    windowSettings: WindowSettings;
}

async function createServices(context: ExtensionContext, logOutputChannel: LogOutputChannel | undefined): Promise<Readonly<Services>> {

    const windowSettings = new WindowSettings(logOutputChannel);
    const resourceStateCoordinator = await ResourceStateCoordinator.create(30_000, logOutputChannel);
    const resourceProps = { windowSettings, resourceStateCoordinator };
    const taskProcessLifecycle = new TaskProcessLifecycle(resourceProps, logOutputChannel);
    const fileDecorationProvider = new FileDecorationProvider(resourceProps, logOutputChannel);

    const extDisplayName = context.extension.packageJSON['displayName'] as string;
    const diagnosticsManager = new DiagnosticsManager(extDisplayName, resourceProps, logOutputChannel);

    const treeViewPanel = new TreeViewPanel(
        resourceProps,
        taskProcessLifecycle.taskProcessRegistry,
        logOutputChannel
    );

    return {
        diagnosticsManager,
        fileDecorationProvider,
        resourceStateCoordinator,
        taskProcessLifecycle,
        treeViewPanel,
        windowSettings
    };
}

const Services = {
    createServices
};

export default Services;
