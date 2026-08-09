import ScopeKey from '../ScopeKey';

import {
    Uri,
    workspace
} from 'vscode';
import type Immutable from '../utils/Immutable';


// type Scope = GlobalScope | WorkspaceScope | FolderScope;



interface GlobalScope {
    key: ScopeKey.GlobalKey;
    name: 'User',
    taskSource: null;
};

interface WorkspaceScope {
    key: ScopeKey.WorkspaceKey;
    name: string;
    taskSource: ScopeLayout.TaskSource;
}

interface FolderScope {
    key: ScopeKey.FolderKey;
    name: string;
    isPrima: boolean;
    uri: Uri,
    taskSource: ScopeLayout.TaskSource;
}

interface ScopeLayout {
    isMultiRoot: boolean;
    globalScope: GlobalScope;
    workspaceScope: WorkspaceScope | null;
    folderScopes: Array<FolderScope> | null;
}


/** Формирует снапшот всех активных областей: глобальной (User),
 * рабочей области (workspace) и папок (workspace folders).
 *
 * Глобальная область *не имеет sourceUri*.
 *
 * Workspace-область может быть null (нет открытого workspace). */
function getLayout(): Immutable<ScopeLayout> {

    const isMultiRoot = workspace.workspaceFile != null;

    return {
        isMultiRoot,
        globalScope: {
            key: ScopeKey.GLOBAL_KEY,
            name: 'User',
            taskSource: null
        },
        workspaceScope:
            isMultiRoot
                ? {
                    key: ScopeKey.WORKSPACE_KEY,
                    name: workspace.name!,
                    taskSource: {
                        uri: workspace.workspaceFile!,
                        JSONPath: ['tasks', 'tasks'] as const
                    }
                }
                : null,
        folderScopes: workspace.workspaceFolders?.map((folder) => {
            const key = folder.uri.toString() as ScopeKey.FolderKey;
            const taskSource = {
                uri: Uri.joinPath(folder.uri, '.vscode', 'tasks.json'),
                JSONPath: ['tasks'] as const
            };
            return {
                key,
                name: folder.name,
                uri: folder.uri,
                taskSource,
                isPrima: folder.index === 0
            };
        }) ?? []
    };
}

const ScopeLayout = {
    getLayout
};

declare namespace ScopeLayout {

    interface TaskSource {
        uri: Uri;
        JSONPath: readonly ['tasks'] | ['tasks', 'tasks'];
    }

}

export default ScopeLayout;
