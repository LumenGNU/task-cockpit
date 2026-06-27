

import {
    type ExtensionContext,
    commands
} from 'vscode';
import TreeViewPanel from './TreeViewPanel/TreeViewPanel';


export async function activate(context: ExtensionContext) {

    const treeViewPanel = new TreeViewPanel();
    treeViewPanel.forceUpdate();

    commands.registerCommand('task-cockpit.view.refresh', () => {
        treeViewPanel.forceUpdate();
    });

}

export function deactivate() {

}
