

import {
    type ExtensionContext,
    commands,
    LogOutputChannel,
    window
} from 'vscode';
import Panel from './TreeViewPanel/Panel';
import FileDecorationProvider from './DecorationProvider/FileDecorationProvider';
import ConfigurationState from './ReaourceState/State';
import {
    CONFIG_BASE_SECTION
} from './constants';
import DiagnosticsManager from './TasksSource/Diagnostics/DiagnosticsManager';

let logOutputChannel: LogOutputChannel | null = null;


export async function activate(context: ExtensionContext) {

    logOutputChannel = window.createOutputChannel(context.extension.id, { log: true });
    const configurationProvider = new ConfigurationState(CONFIG_BASE_SECTION);
    const fileDecorationProvider = new FileDecorationProvider(configurationProvider, logOutputChannel);
    // @todo dispose
    window.registerFileDecorationProvider(fileDecorationProvider);
    const diagnosticsManager = new DiagnosticsManager(configurationProvider, logOutputChannel);

    const cockpit = new Panel(configurationProvider, logOutputChannel);
    cockpit.forceUpdate();

    commands.registerCommand('task-cockpit.view.refresh', () => {
        cockpit.forceUpdate();
    });


    commands.registerCommand('task-cockpit.DEBUG.print-tree-item', (arg) => {
        console.log(arg);
        cockpit.DEBUG_print_tree_item(arg);
    });

}

export function deactivate() {

    logOutputChannel?.dispose();

}
