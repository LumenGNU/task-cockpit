import * as vscode from 'vscode';
import WindowSettings from "../../src/WindowSettings/WindowSettings";
import TaskProcessLifecycle from "../../src/Runtime/TaskProcessLifecycle";
import TaskName from '../../src/TaskName';
import ResourceStateCoordinator from "../../src/ResourceStateCoordinator/ResourceStateCoordinator";
import OriginEntry from '../../src/ResourceStateCoordinator/OriginEntry';
import Immutable from '../../src/utils/Immutable';
import type OriginKey from '../../src/OriginKey';
import DiagnosticManager from '../../src/TasksSource/Diagnostics/DiagnosticsManager';

export async function activate(context: vscode.ExtensionContext): Promise<void> {

    const ext = context.extension;
    const extName = ext.packageJSON['displayName'];

    const logChannel = vscode.window.createOutputChannel(extName);
    const traceChannel = vscode.window.createOutputChannel(`${extName} - trace`, { log: true });
    context.subscriptions.push(logChannel, traceChannel);

    void vscode.window.showInformationMessage(`"${extName}" activated`);
    logChannel.show();

    await run(context.subscriptions, logChannel, traceChannel);
}

export function deactivate(): void { }




// ----------------------------------------------

async function run(
    subscriptions: vscode.Disposable[],
    logChannel: vscode.OutputChannel,
    traceChannel: vscode.LogOutputChannel
) {
    const resourceStateCoordinator = await ResourceStateCoordinator.create(5_000, traceChannel);
    const windowSettings = new WindowSettings(traceChannel);
    const runtime = new TaskProcessLifecycle({
        resourceStateCoordinator,
        windowSettings
    },
        traceChannel
    );

    const diagnosticsManager = new DiagnosticManager('Task Cockpit',
        {
            resourceStateCoordinator,
            windowSettings
        },
        traceChannel);


    const render = async () => {
        const originEntries = await resourceStateCoordinator.getOriginEntries();
        const parts: string[] = [];

        parts.push(await formatOriginEntry(originEntries.User, runtime.taskProcessRegistry, resourceStateCoordinator));

        if (originEntries.Workspace) {
            parts.push(await formatOriginEntry(originEntries.Workspace, runtime.taskProcessRegistry, resourceStateCoordinator));
        }

        for (const originEntry of originEntries.folders) {
            parts.push(await formatOriginEntry(originEntry, runtime.taskProcessRegistry, resourceStateCoordinator));
        }

        logChannel.replace(parts.join('\n'));
    };

    await render();

    subscriptions.push(
        resourceStateCoordinator,
        resourceStateCoordinator.onDidCompleteUpdate(() => { void render(); }),
        runtime,
        runtime.taskProcessRegistry.onDidChangeTaskProcesses(() => { void render(); }),
        diagnosticsManager
    );
}


async function formatOriginEntry(
    originEntry: Immutable<OriginEntry>,
    processRegistry: TaskProcessLifecycle.TaskProcessRegistryView,
    resourceStateCoordinator: ResourceStateCoordinator
): Promise<string> {

    const segmentSeparator = originEntry.hierarchyConfig.segmentSeparator;

    const definitionEntries = [...originEntry.definitionEntries];

    const taskLines =
        definitionEntries.length === 0
            ? ['    (empty)']
            : await Promise.all(
                definitionEntries.map(([taskName]) =>
                    formatTaskLabel(
                        originEntry.originKey,
                        taskName,
                        TaskName.formatTaskName(taskName, { segmentSeparator, displaySeparator: '·' }),
                        resourceStateCoordinator,
                        processRegistry
                    )
                )
            );

    const out = [
        originEntry.name,
        '-'.repeat(originEntry.name.length),
        ...taskLines
    ];

    return out.join('\n') + '\n';
}


async function formatTaskLabel(
    originKey: OriginKey,
    taskName: TaskName,
    displayName: string,
    resourceStateCoordinator: ResourceStateCoordinator,
    processRegistry: TaskProcessLifecycle.TaskProcessRegistryView
) {

    const { taskDefinition, eligibleTask } = await resourceStateCoordinator.getTaskBundle(originKey, taskName);
    const processStates = processRegistry.getTaskProcessStates(originKey, taskName);
    const marker = (() => {
        if (taskDefinition == null) return '⦸';
        if (eligibleTask == null) return '⚠';
        if (processStates != null) {
            return [...processStates.values()].some((s) => s.running) ? '⦿' : '⦾';
        }
        return '▪';
    })();

    return `    ${marker} ${displayName}`;

}
