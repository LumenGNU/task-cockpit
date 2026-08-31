import {
    env,
    type LogOutputChannel,
    ThemeIcon,
    window,
} from 'vscode';
import type TaskNodeData from '../TreeViewPanel/TaskNodeData';
import type LifecycleOmitted from '../utils/LifecycleOmitted';
import type TaskProcessLifecycle from '../Runtime/TaskProcessLifecycle';

async function navigateToTerminal(
    taskNodeData: TaskNodeData,
    taskProcessLifecycle: LifecycleOmitted<TaskProcessLifecycle>,
    logOutputChannel: LogOutputChannel | undefined
) {

    // @fixme

    // const { taskOrigin, taskName, taskLabel } = taskNodeData;

    // const taskProcessRecords = await taskProcessLifecycle.getTaskProcessRecords(taskOrigin, taskName);

    // const iconPath = new ThemeIcon('terminal');

    // const items = [];
    // for (const record of taskProcessRecords) {
    //     items.push({
    //         label: `Process ID: ${record.taskProcessId}`,
    //         iconPath,
    //         description: record.running ? 'running' : 'completed',
    //         detail: new Date(record.timestamp).toLocaleString(env.language),
    //         terminalRef: record.terminalRef
    //     });
    // }
    // if (items.length > 1) {
    //     const selected = await window.showQuickPick(items, {
    //         title: taskLabel,
    //         placeHolder: 'Select terminal',
    //         matchOnDescription: true,
    //         matchOnDetail: true
    //     });
    //     selected?.terminalRef.deref()?.show();
    //     return;
    // }
    // if (items.length > 0) {
    //     items[0]?.terminalRef.deref()?.show();
    //     return;
    // }
    // return;
}

export default navigateToTerminal;
