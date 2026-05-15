/** @file Scopes/Scope.ts */
/** @module Scope */

import * as vscode from 'vscode';
import { WorkspaceKey } from '../constants';

import List from './List';
import type ListType from './List';
import type { ScopeKey } from '../type.d/ScopeKey';
import type { FolderKey } from '../type.d/FolderKey';
import type { SourceUri } from '../type.d/SourceUri';
import type { TaskSource } from '../type.d/TaskSource';



type Scope = vscode.TaskScope.Workspace | vscode.WorkspaceFolder;

declare namespace Scope {

    export type List = ListType;

}


/** Scope — где определена задача и ее настройки. Это единица владения задачами.
 * У каждой задачи есть ровно один scope, задачи из разных scope не перемешиваются,
 * и всё, что работает с задачами, работает в контексте конкретного scope.
 * */
const Scope = {

    // Scope → Key (сериализация) */
    getKey(scope: Scope): ScopeKey {

        if (scope === vscode.TaskScope.Workspace) {
            return WorkspaceKey;
        }

        return scope.uri.toString() as FolderKey;
    },

    displayName(scope: Scope): string {

        if (scope === vscode.TaskScope.Workspace) {
            return vscode.workspace.name ?? '<untitled> (Workspace)';
        }

        return scope.name;
    },

    /** Источник задач для данного scope: vscode.Uri файла и JSON-путь
     * до массива задач внутри него.
     *
     * - Folder-scope → `.vscode/tasks.json`, путь `['tasks']`.
     * - Workspace-scope → `.code-workspace`, путь `['tasks', 'tasks']`.
     *
     * Возвращает `null`, если файл-источник не существует
     *
     * Семантика: "эта область (не)разрешается в источник задач".
     * Не дает информации "есть ли задачи фактически". */
    async resolveSource(scope: Scope): Promise<Readonly<TaskSource> | null> {

        if (scope === vscode.TaskScope.Workspace) {
            if (vscode.workspace.workspaceFile) {
                return {
                    uri: vscode.workspace.workspaceFile as SourceUri,
                    JSONPath: ['tasks', 'tasks']
                };
            }
            return null;
        }

        const sourceUri = vscode.Uri.joinPath(scope.uri, '.vscode', 'tasks.json') as SourceUri;


        try {
            const stat = await vscode.workspace.fs.stat(sourceUri);
            if (!(stat.type & vscode.FileType.File)) {
                return null;
            }
        }
        catch {
            return null;
        }

        return {
            uri: sourceUri,
            JSONPath: ['tasks']
        };
    },

    List: List,

} as const;

export default Scope;
