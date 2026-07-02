import type {
    Uri
} from 'vscode';
import type SourceFile from './SourceFile';


declare const ___SourceUri: unique symbol;


/** Брендированный URI файла задач.
 *
 * Гарантирует, что `fsPath` возвращает {@linkcode SourceFile}.
 *
 * НЕ обязан существовать физически */
type SourceUri = Uri & {
    readonly [___SourceUri]: never;
    fsPath: SourceFile;
};


export default SourceUri;
