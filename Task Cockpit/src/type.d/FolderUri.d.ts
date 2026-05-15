import type * as vscode from 'vscode';
import type { FolderKey } from './FolderKey';

declare const ___FolderUri: unique symbol;

/** URI папки workspace.
 *
 * Переопределяет {@linkcode vscode.Uri.toString} — возвращает {@linkcode Key},
 * что позволяет использовать URI напрямую как ключ сериализации. */
export type FolderUri = Omit<vscode.Uri, 'toString'> & {
    readonly [___FolderUri]: never;
    toString(): FolderKey;
};
