import type * as vscode from 'vscode';
import type { ScopeFile } from '../Scope/ScopeFile';

declare const ___SourceUri: unique symbol;

/** Брендированный URI файла задач.
 *
 * Гарантирует, что `fsPath` возвращает {@linkcode ScopeFile}.
 *
 * НЕ обязан существовать физически */
export type SourceUri = vscode.Uri & {
    readonly [___SourceUri]: never;
    fsPath: ScopeFile;
};
