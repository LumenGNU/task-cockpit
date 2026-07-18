
import type * as vscode from 'vscode';
import type FolderUri from '../Scope/Folder/Uri';
import type Scope from '../Scope/Scope';

type Immutable<T> =
    unknown extends T
    ? T
    : T extends
    | string
    | number
    | boolean
    | null
    | undefined
    | symbol
    | bigint
    ? T

    : T extends (...args: any[]) => any
    ? T

    : T extends RegExp | Date
    ? T

    : T extends
    | Scope
    | FolderUri
    ? Readonly<T>

    : T extends
    | vscode.Uri
    | Error
    ? Readonly<T>

    : T extends
    | Map<infer K, infer V>
    | ReadonlyMap<infer K, infer V>
    ? ReadonlyMap<K, Immutable<V>>

    : T extends
    | Set<infer U>
    | ReadonlySet<infer U>
    ? ReadonlySet<Immutable<U>>

    : T extends
    | Array<infer U>
    | ReadonlyArray<infer U>
    ? ReadonlyArray<Immutable<U>>

    : { readonly [K in keyof T]: Immutable<T[K]> };

export default Immutable;
