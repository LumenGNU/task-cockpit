import {
    TaskScope as VscTaskScope,
    type WorkspaceFolder
} from 'vscode';
import type Immutable from './utils/Immutable';

declare const ___Folder: unique symbol;


type GlobalKey = ScopeKey.GlobalKey;
type WorkspaceKey = ScopeKey.WorkspaceKey;
type FolderKey = ScopeKey.FolderKey;


function getScopeKey(scope: Immutable<VscTaskScope.Global | VscTaskScope.Workspace | WorkspaceFolder>): ScopeKey {

    if (scope === VscTaskScope.Global) {
        return ScopeKey.GLOBAL_KEY;
    }
    else if (scope === VscTaskScope.Workspace) {
        return ScopeKey.WORKSPACE_KEY;
    }

    return scope.uri.toString() as FolderKey;
}


type ScopeKey = GlobalKey | WorkspaceKey | FolderKey;

declare namespace ScopeKey {
    type GlobalKey = '\x00\x00$Global';
    type WorkspaceKey = '\x00\x00$Workspace';
    // Проблема:
    // ===-сужение в TypeScript работает на основе строкового значения, а не структуры.
    // Бренд { readonly [___Folder]: never } для сужения невидим — TypeScript не может доказать,
    // что string & brand не может оказаться '\x00\x00$Workspace' в рантайме.
    // URI папки всегда содержит ":" — что для VS Code является инвариантом.
    // Теперь TypeScript при проверке scopeKey === ScopeKey.WORKSPACE_KEY вычислит:
    // - '\x00\x00$Workspace' — совпадает
    // - string:{string} & brand— пересечение с'\x00\x00$Workspace', нет ":" = never` → выбрасывается
    type FolderKey = `${string}:${string}` & {
        readonly [___Folder]: never;
    };
}

const ScopeKey = {
    GLOBAL_KEY: '\x00\x00$Global' satisfies GlobalKey,
    WORKSPACE_KEY: '\x00\x00$Workspace' satisfies WorkspaceKey,
    getScopeKey
} as const;

export default ScopeKey;
