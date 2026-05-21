/** @file Workspace/Scope.ts */
/** @module Scope */

import {
    TaskScope,
    WorkspaceFolder,
    workspace as VscWorkspace,
    Uri,
    CancellationToken
} from 'vscode';
import { WorkspaceKey } from '../constants';
import type FolderKey from '../type.d/FolderKey';
import type ScopeKey from '../type.d/ScopeKey';
import type SourceUri from '../type.d/SourceUri';
import Definition from './Definition';
import TaskSource from './TaskSource';
import type ScopedConfig from './ScopedConfig';


type Scope = TaskScope.Workspace | WorkspaceFolder;


/** Scope — где определена задача и ее настройки. Это единица владения задачами.
 * У каждой задачи есть ровно один scope, задачи из разных scope не перемешиваются,
 * и всё, что работает с задачами, работает в контексте конкретного scope.
 * */
const Scope = {

    // Scope → Key (сериализация) */
    getKey(scope: Scope): ScopeKey {

        if (scope === TaskScope.Workspace) {
            return WorkspaceKey;
        }

        return scope.uri.toString() as FolderKey;
    },


    displayName(scope: Scope): string {

        if (scope === TaskScope.Workspace) {
            return VscWorkspace.name ?? '<untitled> (Workspace)';
        }

        return scope.name;
    },


    /** URI файла ассоциированного со скопою. НЕ обязан существовать физически */
    getSourceUri(scope: Scope): SourceUri {

        if (scope === TaskScope.Workspace) {
            return VscWorkspace.workspaceFile as SourceUri;
        }

        return Uri.joinPath(scope.uri, '.vscode', 'tasks.json') as SourceUri;
    },


    getScopedConfig(scope: Scope, reader: ScopedConfig.Reader): ScopedConfig {
        return reader.read(scope);
    },


    /**
      * @param token токен отмены.
      *
      * @throws { CancellationError } при отмене через `token`.
      *  */
    async fetchDefinition(scope: Scope, token: CancellationToken): Promise<Definition.ScopeMap> {

        const source = await TaskSource.resolveSource(Scope.getSourceUri(scope));

        if (!source) {
            return Object.create(null) as Definition.ScopeMap;
        }

        return await Definition.fetch(source, token);

    }

} as const;

export default Scope;
