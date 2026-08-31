import { GLOBAL_TREE_VIEW, PROJECT_TREE_VIEW } from '../common';
import type TreeViewPanel from '../TreeViewPanel/TreeViewPanel';


function resolveTreeElement(reason: unknown, treeViewPanel: TreeViewPanel): object | undefined {

    // черти-как вызвана
    if (reason == null) { return undefined; }

    // вызвана из меню
    if (typeof reason === 'object' && !Array.isArray(reason)) {
        return reason;
    }

    // вызвана с клавиатуры
    if (typeof reason === 'string') {

        const treeViewId =
            (reason === 'global-task')
                ? GLOBAL_TREE_VIEW.ID
                : (reason === 'project-task')
                    ? PROJECT_TREE_VIEW.ID
                    : null;

        if (!treeViewId) { return undefined; }
        return treeViewPanel.getSelection(treeViewId);
    }

    return undefined;
}


export default resolveTreeElement;
