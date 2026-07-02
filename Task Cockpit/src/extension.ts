

import {
    type ExtensionContext,
    commands
} from 'vscode';
import Cockpit from './Cockpit/Cockpit';


export async function activate(context: ExtensionContext) {

    const treeViewPanel = new Cockpit();
    treeViewPanel.forceUpdate();

    commands.registerCommand('task-cockpit.view.refresh', () => {
        treeViewPanel.forceUpdate();
    });

}

export function deactivate() {

}
