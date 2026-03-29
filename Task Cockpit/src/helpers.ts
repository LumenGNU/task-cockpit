/** @file helpers.ts */
/** @module helpers */

import * as vscode from 'vscode';
import type * as TC from './types';


const C0_GS: TC.CG_Separator = '\x1D' as const;


/** Создаёт строку TaskID из файла-источника и имени задачи.
 *
 * @param file путь к файлу задач
 * @param name метка задачи
 * @returns составной идентификатор задачи */
function buildId(file: TC.File, name: TC.Name): TC.TaskID {
    return `${file}${C0_GS}${name}` as TC.TaskID;
}


function parseId(taskId: TC.TaskID): { taskFile: TC.File, taskName: TC.Name; } {
    const [taskFile, taskName] = taskId.split(C0_GS) as [TC.File, TC.Name];
    return {
        taskFile,
        taskName
    };
}

/** Возвращает URI "валидного" файла-источника для задачи.
 *
 * На данный момент валидные источники:
 * - .vscode/tasks.json файлы
 * - .code-workspace файл, для multi-root-проектов
 *
 * Для остальных источников будет возвращаться undefined.
 *
 * Возвращается "условно ассоциированный" URI, т.е. не
 * гарантируется, что он существует физически. */
function resolveScopeUri(task: vscode.Task): TC.Uri | undefined {

    const scope = task.scope;

    // пропуск глобальных задач, и "виртуальных" задач
    if (!scope || scope === vscode.TaskScope.Global) {
        return undefined;
    }

    if (scope === vscode.TaskScope.Workspace) {
        return vscode.workspace.workspaceFile as TC.Uri | undefined;
    }

    return vscode.Uri.joinPath(scope.uri, '.vscode', 'tasks.json') as TC.Uri;
}


function resolveId(task: vscode.Task): TC.TaskID | undefined {
    const file = resolveScopeUri(task)?.fsPath;

    // "виртуальные" (без scope) и глобальные задачи будут пропущены
    if (!file) {
        return undefined;
    }

    return buildId(
        file,
        task.name as TC.Name
    );
}


function resolveUri(file: TC.File): TC.Uri {
    return vscode.Uri.file(file) as TC.Uri;
}


function printTaskId(taskId: TC.TaskID): string {
    const { taskFile, taskName } = parseId(taskId);
    const relFile = vscode.workspace.asRelativePath(taskFile);
    return `${relFile} • ${taskName}`;
}


/** Возвращает путь к массиву задач в JSONC-структуре файла.
 *
 * Для файлов с расширением `.json` массив задач находится в корне: `{ tasks[] }`.
 * Для остальных (`.code-workspace` и т.д.) — вложен на уровень глубже: `{ tasks: { tasks[] } }`.
 *
 * @param fileUri URI файла задач
 * @returns JSON-путь к массиву задач */
function resolveJsonPath(fileUri: TC.Uri): string[] {
    if (fileUri.fsPath.endsWith('.json')) {
        return ['tasks'];
    }
    return ['tasks', 'tasks'];
}


/** Проверяет, является ли переданный PID валидным числом > 0.
 *
 * @remarks
 * VS Code не стесняется передавать как PID задачи — `undefined`
 *
 * @param pid - PID для проверки
 * @returns true если PID является валидным числом > 0, false иначе */
function isValidPid(pid: number | undefined): pid is TC.ProcessId {
    return (pid !== undefined && Number.isInteger(pid) && pid > 0);
}


function encodeQueryComponent(queryMetadata: TC.VisualMetadata): TC.QueryComponent {
    return encodeURIComponent(JSON.stringify(queryMetadata)) as TC.QueryComponent;
}


function decodeQueryComponent(queryComponent: TC.QueryComponent): TC.VisualMetadata | undefined {

    const queryMetadata = JSON.parse(decodeURIComponent(queryComponent));
    if (typeof queryMetadata !== 'object') {
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



function isName(label: any): label is TC.Name {
    return typeof label === 'string' && label.length > 0;
}


export default {
    buildId,
    encodeQueryComponent,
    isName,
    isValidPid,
    parseId,
    resolveId,
    resolveJsonPath,
    resolveMetadata,
    resolveScopeUri,
    resolveUri,
    printTaskId,
};
