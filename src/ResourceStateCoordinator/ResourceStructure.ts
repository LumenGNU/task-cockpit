/** @file ResourceStateCoordinator/ResourceStructure.ts */
/** @internal */

import {
    Uri,
    workspace
} from 'vscode';
import OriginKey from '../OriginKey';

import type Immutable from '../utils/Immutable';
import type TaskSource from './TaskSource';

interface UserOrigin {
    name: 'User',
    originKey: OriginKey.User;
    taskSource: null;
}

interface WorkspaceOrigin {
    name: string;
    originKey: OriginKey.Workspace;
    taskSource: TaskSource;
}

interface FolderOrigin {
    isPrimary: boolean;
    name: string;
    originKey: OriginKey.Folder;
    taskSource: TaskSource;
    uri: Uri,
}

interface ResourceStructure {
    folders: Array<FolderOrigin> | null;
    User: UserOrigin;
    Workspace: WorkspaceOrigin | null;
}

const ResourceStructure = {
    build
};

/** Формирует снапшот всех активных областей: глобальной (User),
 * рабочей области (workspace) и папок (workspace folders).
 *
 * Глобальная область *не имеет taskSource*.
 *
 * Workspace-область может быть null (нет открытого workspace). */
function build(): Immutable<ResourceStructure> {

    const isMultiRoot = workspace.workspaceFile != null;

    return {
        User: {
            originKey: OriginKey.USER,
            name: 'User',
            taskSource: null
        },
        Workspace:
            isMultiRoot
                ? {
                    originKey: OriginKey.WORKSPACE,
                    name: workspace.name!,
                    taskSource: {
                        uri: workspace.workspaceFile!,
                        JSONPath: ['tasks', 'tasks'] as const
                    }
                }
                : null,
        folders: workspace.workspaceFolders?.map((folder) => {
            const originKey = folder.uri.toString() as OriginKey.Folder;
            const taskSource = {
                uri: Uri.joinPath(folder.uri, '.vscode', 'tasks.json'),
                JSONPath: ['tasks'] as const
            };
            return {
                originKey,
                name: folder.name,
                uri: folder.uri,
                taskSource,
                isPrimary: folder.index === 0
            };
        }) ?? []
    };
}

export default ResourceStructure;
