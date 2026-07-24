import {
    workspace,
} from 'vscode';
import * as assert from 'node:assert/strict';
import TaskName from '../../TaskName';

import type { State } from '../State';
import type Group from './Group';
import type Icon from './Icon';
// import type Immutable from '../../utils/Immutable';
import type RawTaskDefinition from './RawTaskDefinition';
import ScopeKey from '../../ScopeKey';
import type TaskDefinition from './TaskDefinition';
import type TaskGroup from './TaskGroup';



/** Читает конфигурацию и возвращает карту определений задач, проиндексированных
 *  по имени задачи ({@link TaskName}).
 *
 * - Ключ: строковое имя задачи (`label`), прошедшее валидацию.
 * - Значение: объект {@link TaskDefinition}, содержащий нормализованные поля
 *   (`group`, `icon`, `hidden`, `isBackground`).
 *
 * Особенности:
 * - Порядок записей соответствует порядку в исходном файле (точнее в порядке из VS Code)
 * - При наличии дубликатов ключей последние определения перезаписывают предыдущие.
 * - Карта является `ReadonlyMap`, не предполагается модификация
 *   после построения.
 *
 * @param scope Область-источник определений задач
 *  */
function mapTaskDefinitions(scopeLayout: State.ScopeLayout): Map<ScopeKey, Map<TaskName, TaskDefinition>> {

    const outMap = new Map<ScopeKey, Map<TaskName, TaskDefinition>>();


    outMap.set(ScopeKey.GLOBAL_KEY, buildTaskDefinitionsMap(getIsolatedGlobalTasks()));

    if (scopeLayout[ScopeKey.WORKSPACE_KEY]) {
        outMap.set(ScopeKey.WORKSPACE_KEY, buildTaskDefinitionsMap(getIsolatedWorkspaceTasks()));
    }

    if (scopeLayout.folders) {
        for (const [folderKey, folderScope] of Object.entries(scopeLayout.folders)) {
            outMap.set(folderKey as ScopeKey.FolderKey, buildTaskDefinitionsMap(getIsolatedFolderTasks(folderScope)));
        }
    }

    return outMap;

}


function buildTaskDefinitionsMap(rawArr: Array<RawTaskDefinition>): Map<TaskName, TaskDefinition> {
    return rawArr.reduce(addDefinitionToMap, new Map<TaskName, TaskDefinition>());
}


function getIsolatedGlobalTasks(): Array<RawTaskDefinition> {
    return workspace.getConfiguration('tasks', null).inspect<Array<RawTaskDefinition>>('tasks')?.globalValue ?? [];
}


function getIsolatedWorkspaceTasks(): Array<RawTaskDefinition> {
    return workspace.getConfiguration('tasks', null).inspect<Array<RawTaskDefinition>>('tasks')?.workspaceValue ?? [];
}


function getIsolatedFolderTasks(scope: State.FolderScope): Array<RawTaskDefinition> {
    return workspace.getConfiguration('tasks', scope).inspect<Array<RawTaskDefinition>>('tasks')?.workspaceFolderValue ?? [];
}


function addDefinitionToMap(
    map: Map<TaskName, TaskDefinition>,
    raw: RawTaskDefinition,
): Map<TaskName, TaskDefinition> {

    // Пропускаем записи без- или с невалидным названием.
    if (!TaskName.nameIsQualifies(raw.label)) {
        return map;
    }

    const definition: TaskDefinition = {
        hidden: parseHiddenFlag(raw.hide),
        isBackground: parseBackgroundFlag(raw.isBackground),
        icon: parseTaskIcon(raw.icon),
        group: parseTaskGroup(raw.group),
        taskName: raw.label,
    };

    // (дубликаты label'ов возможны, но будут поглощены)
    map.set(raw.label, definition);
    return map;
}


// #region Валидаторы/парсеры
// --------------------------


/** Разбирает сырое значение `group` из файла-источника.
 *
 * Допустимые формы:
 * - строка — преобразуется в объект с `isDefault: false`;
 * - объект с полем `kind` — извлекается `kind` и `isDefault`.
 *
 * @returns `null` при отсутствии или невалидном значении. */
function parseTaskGroup(raw: unknown): TaskGroup | null {

    if (raw == null) {
        return null;
    }

    if (typeof raw === 'string') {
        return { kind: capitalizeGroupKind(raw), isDefault: false };
    }

    if (typeof raw === 'object' && 'kind' in raw && typeof raw.kind === 'string') {

        return {
            kind: capitalizeGroupKind(raw.kind),
            isDefault: 'isDefault' in raw && raw.isDefault === true
        };
    }

    return null;
}


/** Приводит первую букву `kind` к верхнему регистру
* (`"build"` → `"Build"`). */
function capitalizeGroupKind(kind: string): Group {
    return kind.charAt(0).toUpperCase() + kind.slice(1) as Group;
}


/** Разбирает сырое значение `icon` из файла-источника.
 *
 * Ожидает объект с необязательными полями `id` (codicon)
 * и `color` (ThemeColor). Хотя бы одно должно присутствовать.
 *
 * @returns `null` если не объект или оба поля отсутствуют. */
function parseTaskIcon(raw: unknown): Icon | null {

    if (raw == null || typeof raw !== 'object') {
        return null;
    }

    const id = 'id' in raw && typeof raw.id === 'string' ? raw.id : undefined;
    const color = 'color' in raw && typeof raw.color === 'string' ? raw.color : undefined;

    return (id || color) ? { id, color } : null;
}


/** @returns `true` только если сырое значение — литерал `true`. */
function parseHiddenFlag(raw: unknown): boolean {
    return typeof raw === 'boolean' ? raw === true : false;
}


/** @returns `true` только если сырое значение — литерал `true`. */
function parseBackgroundFlag(raw: unknown): boolean {
    return typeof raw === 'boolean' ? raw === true : false;
}

// #endregion Валидаторы/парсеры


export default mapTaskDefinitions;
