import * as vscode from 'vscode';
import type * as TC from '../../types';
import Scope from './Scope';
import type IDefinition from './Definition';


// declare namespace Scopes {

//     export interface Scope {
//         readonly key: TC.ScopeKey;
//         readonly displayName: string;
//         readonly configuration: Readonly<Scope.ScopedSettings>;
//         readonly fetchDefinitions: (token: vscode.CancellationToken) => Promise<ReadonlyArray<Readonly<Scope.Definition>>>;
//     }

//     export namespace Scope {
//         export type Definition = IDefinition;
//         export type ScopedSettings = IScopedSettings;
//     }

//     export interface ScopesDetail {
//         readonly total: number;
//         readonly displayed: number;
//     }
// }

const Scopes = {

    get(excludes: ReadonlySet<string>): Readonly<{
        readonly scopeIndex: Readonly<Record<TC.ScopeKey, Readonly<Scopes.Scope>>>;
        readonly scopesDetail: Readonly<Scopes.ScopesDetail>;
    }> {

        const scopeIndex = Object.create(null) as Record<TC.ScopeKey, Readonly<Scope>>;

        const scopesDetail = {
            total: 0,
            displayed: 0
        };

        // если есть — всегда первым
        if (vscode.workspace.workspaceFile) {
            ++scopesDetail.total;
            const wsScope = new Scope(vscode.TaskScope.Workspace);
            if (!excludes.has(wsScope.displayName)) {
                ++scopesDetail.displayed;
                scopeIndex[wsScope.key] = wsScope;
            }
        }

        if (vscode.workspace.workspaceFolders?.length) {
            for (const folder of vscode.workspace.workspaceFolders) {
                ++scopesDetail.total;
                const dirScope = new Scope(folder);
                if (!excludes.has(dirScope.displayName)) {
                    ++scopesDetail.displayed;
                    scopeIndex[dirScope.key] = dirScope;
                }
            }
        }

        return {
            scopesDetail,
            scopeIndex
        };
    }

} as const;


export default Scopes;
