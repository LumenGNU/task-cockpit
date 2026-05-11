import * as vscode from 'vscode';
import type * as TC from '../../types';
import Definitions from './Definitions';
import ScopedSettings from './Settings';
import {
    WORKSPACE_KEY,
    COCKPIT_CNF_SECTION_NAME
} from '../../constants';


declare namespace Scope {

    interface Settings {
        readonly treeConfig: {
            segmentSeparator: string;
            useGroupKind: boolean;
            showHidden: boolean;
        };

        readonly nodeConfig: {
            useFolderIcon: boolean;
            defaultIconName: string;
            tintLabel: boolean;
        };
    }
}


/** Scope — где определена задача и ее настройки. Это единица владения задачами.
 * У каждой задачи есть ровно один scope, задачи из разных scope не перемешиваются,
 * и всё, что работает с задачами, работает в контексте конкретного scope.
 */
class Scope {

    #scope: vscode.TaskScope.Workspace | vscode.WorkspaceFolder;

    /** @internal */
    constructor(scope: vscode.TaskScope.Workspace | vscode.WorkspaceFolder) {
        this.#scope = scope;
    }


    // Scope → Key (сериализация) */
    public get key(): TC.ScopeKey {

        if (this.#scope === vscode.TaskScope.Workspace) {
            return WORKSPACE_KEY;
        }

        return this.#scope.uri.toString() as TC.FolderKey;
    }


    public get displayName(): string {

        if (this.#scope === vscode.TaskScope.Workspace) {
            return vscode.workspace.name ?? '<untitled> (Workspace)';
        }

        return this.#scope.name;
    }


    /** Источник задач для данного scope: vscode.Uri файла и JSON-путь
     * до массива задач внутри него.
     *
     * - Folder-scope → `.vscode/tasks.json`, путь `['tasks']`.
     * - Workspace-scope → `.code-workspace`, путь `['tasks', 'tasks']`.
     *
     * Возвращает `null`, если файл-источник не существует
     *
     * Семантика: "эта область (не)разрешается в источник задач".
     * Не дает информации "есть ли задачи фактически". */
    private async resolveSource(): Promise<Readonly<TC.TaskSource> | null> {

        if (this.#scope === vscode.TaskScope.Workspace) {
            if (vscode.workspace.workspaceFile) {
                return {
                    uri: vscode.workspace.workspaceFile as TC.SourceUri,
                    JSONPath: ['tasks', 'tasks']
                };
            }
            return null;
        }

        const sourceUri = vscode.Uri.joinPath(this.#scope.uri, '.vscode', 'tasks.json') as TC.SourceUri;


        try {
            const meta = await vscode.workspace.fs.stat(sourceUri);
            if (!(meta.type & vscode.FileType.File)) {
                return null;
            }
        }
        catch {
            return null;
        }

        return {
            uri: sourceUri,
            JSONPath: ['tasks']
        };
    }


    /** Читает определения задач в этой области
     * @throws {vscode.CancellationError} при срабатывании токена отмены —
     *   единственное исключение, которое пробрасывается наружу. При любых
     *   других проблемах (IO, парсинг) возвращается пустая/частичная карта. */
    public async fetchDefinitions(token: vscode.CancellationToken): Promise<Readonly<Definitions>> {

        const source = await this.resolveSource();

        if (!source) {
            return [];
        }

        return await Definitions.fetch(source, token);

    }

    public get settings(): Readonly<Scope.Settings> {

        const scopedConfiguration = vscode.workspace.getConfiguration(
            COCKPIT_CNF_SECTION_NAME,
            (this.#scope === vscode.TaskScope.Workspace)
                ? undefined
                : this.#scope.uri
        );

        return ScopedSettings.get(scopedConfiguration);
    }

}


export default Scope;
