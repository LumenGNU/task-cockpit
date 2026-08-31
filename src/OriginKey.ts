/** @file OriginKey.ts */

import {
    workspace
} from 'vscode';
import assert from 'node:assert/strict';


declare const ___Folder: unique symbol;

type UserKey = OriginKey.User;
type WorkspaceKey = OriginKey.Workspace;
type FolderKey = OriginKey.Folder;


function resolveOriginName(originKey: OriginKey): string | null {

    if (originKey === OriginKey.USER) {
        return 'User';
    }

    if (originKey === OriginKey.WORKSPACE) {
        return workspace.name ?? null;
    }

    const idx = workspace.workspaceFolders?.findIndex((f) => f.uri.toString() === originKey);

    if (idx == null || idx < 0) {
        return null;
    }

    const name = workspace.workspaceFolders?.[idx]?.name;

    assert.ok(name != null);

    return name;

}

type OriginKey = UserKey | WorkspaceKey | FolderKey;

declare namespace OriginKey {
    type User = '\x00\x00$User';
    type Workspace = '\x00\x00$Workspace';
    // Проблема:
    // ===-сужение в TypeScript работает на основе строкового значения, а не структуры.
    // Бренд { readonly [___Folder]: never } для сужения невидим — TypeScript не может доказать,
    // что string & brand не может оказаться '\x00\x00$Workspace' в рантайме.
    // URI папки всегда содержит ":" — что для VS Code является инвариантом.
    // Теперь TypeScript при проверке scopeKey === ScopeKey.WORKSPACE_KEY вычислит:
    // - '\x00\x00$Workspace' — совпадает
    // - string:{string} & brand— пересечение с'\x00\x00$Workspace', нет ":" = never` → выбрасывается
    type Folder = `${string}:${string}` & {
        readonly [___Folder]: never;
    };
}

function isOriginKey(raw: unknown): raw is OriginKey {
    return typeof raw === 'string' && raw.length > 0;
}

const OriginKey = {
    USER: '\x00\x00$User' satisfies UserKey,
    WORKSPACE: '\x00\x00$Workspace' satisfies WorkspaceKey,
    resolveOriginName,
    isOriginKey,
} as const;

export default OriginKey;
