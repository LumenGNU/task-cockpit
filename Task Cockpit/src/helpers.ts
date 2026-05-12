/** @file helpers.ts */
/** @module helpers */

import * as vscode from 'vscode';
import type * as TC from './types';


// const C0_GS: TC.Group_Separator = '\x1D' as const;


// /** Создаёт строку TaskID из файла-источника и имени задачи.
//  *
//  * @param file путь к файлу задач
//  * @param name метка задачи
//  * @returns составной идентификатор задачи */
// function buildId(file: TC.ScopeFile, name: TC.TaskName): TC.TaskId {
//     return `${file}${C0_GS}${name}` as TC.TaskId;
// }


// function parseId(taskId: TC.TaskId): { taskFile: TC.ScopeFile, taskName: TC.TaskName; } {
//     const [taskFile, taskName] = taskId.split(C0_GS) as [TC.ScopeFile, TC.TaskName];
//     return {
//         taskFile,
//         taskName
//     };
// }




function resolveUri(file: TC.ScopeFile): TC.SourceUri {
    return vscode.Uri.file(file) as TC.SourceUri;
}


// function printTaskId(taskId: TC.TaskId): string {
//     const { taskFile, taskName } = parseId(taskId);
//     const relFile = vscode.workspace.asRelativePath(taskFile);
//     return `${relFile} • ${taskName}`;
// }


/** Возвращает путь к массиву задач в JSONC-структуре файла.
 *
 * Для файлов с расширением `.json` массив задач находится в корне: `{ tasks[] }`.
 * Для остальных (`.code-workspace` и т.д.) — вложен на уровень глубже: `{ tasks: { tasks[] } }`.
 *
 * @param fileUri URI файла задач
 * @returns JSON-путь к массиву задач */
function resolveJsonPath(fileUri: TC.SourceUri): string[] {
    if (fileUri.fsPath.endsWith('.json')) {
        return ['tasks'];
    }
    return ['tasks', 'tasks'];
}





function encodeQueryComponent(queryMetadata: TC.VisualMetadata): TC.QueryComponent {
    return encodeURIComponent(JSON.stringify(queryMetadata)) as TC.QueryComponent;
}


function decodeQueryComponent(queryComponent: TC.QueryComponent): TC.VisualMetadata | undefined {

    const queryMetadata: unknown = JSON.parse(decodeURIComponent(queryComponent));
    if (!queryMetadata || typeof queryMetadata !== 'object') {
        return undefined;
    }
    return queryMetadata;
}


type Authority = 'task' | 'marker';

function resolveMetadata(uri: vscode.Uri, ...authorities: Authority[]) {

    if (uri.scheme !== "task-cockpit") {
        return undefined;
    }

    if (authorities.includes(uri.authority as Authority)) {
        return decodeQueryComponent(uri.query as TC.QueryComponent);
    }

}










// /** Сериализует {@link ScopeInfo} в ключ для {@link PinnedStorage}. */
// function scopeIdOf(scopeInfo: TC.ScopeInfo): TC.ScopeIdentity {

//     if (scopeInfo === vscode.TaskScope.Workspace) {
//         return `${vscode.TaskScope.Workspace}`;
//     }

//     return `${scopeInfo.name}${UNIT_SEPARATOR}${scopeInfo.index}`;
// }


// /** Обратная операция к {@link scopeIdOf}.
//  *
//  * Тип `ScopeIdentity` гарантирует корректность формата на входе —
//  * парсинг безошибочен по построению. */
// function parseScopeId(scopeId: TC.ScopeIdentity): TC.ScopeInfo {

//     if (scopeId === `${vscode.TaskScope.Workspace}`) {
//         return vscode.TaskScope.Workspace;
//     }

//     const [name, indexStr] = scopeId.split(UNIT_SEPARATOR);
//     return {
//         name: name as TC.FolderName,
//         // FolderIndex — это number (индекс папки в WorkspaceFolders).
//         // Не забываем привести строку обратно к числу:
//         index: Number(indexStr) as TC.FolderIndex
//     };
// }











export default {

    encodeQueryComponent,

    // isValidPid,

    resolveJsonPath,
    resolveMetadata,

    resolveUri,

};
