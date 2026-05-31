import type {
    Uri as VscUri
} from 'vscode';
import type FolderKey from './Key';


declare const ___Uri: unique symbol;


/** URI папки workspace.
 *
 * Переопределяет {@linkcode VscUri.toString} — возвращает {@linkcode FolderKey},
 * что позволяет использовать URI напрямую как ключ сериализации. */
type Uri = Omit<VscUri, 'toString'> & {
    readonly [___Uri]: never;
    toString(): FolderKey;
};


export default Uri;
