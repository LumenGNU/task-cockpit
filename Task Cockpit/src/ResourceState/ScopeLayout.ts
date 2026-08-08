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
    taskSource: {
        uri: Uri,
        JSONPath: readonly ['tasks', 'tasks'];
    };
}

interface FolderScope {
    key: ScopeKey.FolderKey;
    name: string;
    isPrima: boolean;
    uri: Uri,
    taskSource: {
        uri: Uri,
        JSONPath: readonly ['tasks'];
    };
}

interface ScopeLayout {
    isMultiRoot: boolean;
    globalScope: GlobalScope;
    workspaceScope: WorkspaceScope | null;
    folderScopes: Array<FolderScope> | null;
}


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

export default ScopeLayout;
