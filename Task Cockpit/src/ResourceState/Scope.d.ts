import type { WorkspaceFolder, Uri } from 'vscode';
import type ScopeKey from '../ScopeKey';

declare const ___SourceUri: unique symbol;
declare const ___SourceFile: unique symbol;

declare namespace Scope {

    /** Файл-источник определений задач */
    export interface TaskSource {
        uri: SourceUri;
        JSONPath: Array<string>;
    }

    export interface ScopeLayout {
        [ScopeKey.GLOBAL_KEY]: GlobalScope;
        [ScopeKey.WORKSPACE_KEY]: WorkspaceScope | null;
        folders: { [k: ScopeKey.FolderKey]: FolderScope; } | null;
    }

    export interface GlobalScope {
        name: string;
        taskSource: null;
    }

    export interface WorkspaceScope {
        name: string;
        taskSource: TaskSource | null;
    }

    export type FolderScope = WorkspaceFolder & {
        name: string;
        taskSource: TaskSource;
    };


    /** URI файла-источника задач, связанного с указанной областью:
     *
     * **Не проверяется** физическое существование файла на диске — этот файл
     * в любом случае «ассоциирован», существует он или нет.
     *
     * Для Global-области всегда возвращает null.
     * */
    export type SourceUri = Uri & {
        [___SourceUri]: never;
        fsPath: SourceFile;
    };


    export type SourceFile = string & { readonly [___SourceFile]: never; };
    export type Scope = GlobalScope | WorkspaceScope | FolderScope;
}


export default Scope;
