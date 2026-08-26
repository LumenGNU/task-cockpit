
import type * as vscode from 'vscode';

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
    : T extends readonly unknown[]
    ? number extends T['length']
    ? ReadonlyArray<Immutable<T[number]>>
    : { readonly [K in keyof T]: Immutable<T[K]> }
    : { readonly [K in keyof T]: Immutable<T[K]> };

export default Immutable;
