import {
    workspace,
    type WorkspaceConfiguration
} from 'vscode';
import * as assert from 'node:assert/strict';
import isFolder from '../../Scope/isFolder';
import isGlobal from '../../Scope/isGlobal';
import isWorkspace from '../../Scope/isWorkspace';
import nameIsQualifies from '../../TaskName/nameIsQualifies';
import getScopeKey from '../../Scope/getKey';

import type Group from './Group';
import type Icon from './Icon';
import type RawTaskDefinition from './RawTaskDefinition';
import type Scope from '../../Scope/Scope';
import type TaskDefinition from './TaskDefinition';
import type TaskGroup from './TaskGroup';
import type TaskName from '../../TaskName/TaskName';
import type Immutable from '../../utils/Immutable';
import type ScopeKey from '../../Scope/Key';


function mapTaskDefinitions(scopes: Immutable<Array<Scope>>): Immutable<Map<ScopeKey, Map<TaskName, TaskDefinition>>> {
    return new Map(scopes.map((scope) => {
        return [getScopeKey(scope), buildTaskDefinitionsMap(scope)];
    }));
}

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
function buildTaskDefinitionsMap(scope: Immutable<Scope>): Immutable<Map<TaskName, TaskDefinition>> {

    const raw = getRawTaskDefinitions(scope);
    if (!raw) {
        return new Map();
    }

    return raw.reduce(addDefinitionToMap, new Map<TaskName, TaskDefinition>());
}


function getRawTaskDefinitions(scope: Immutable<Scope>): Immutable<Array<RawTaskDefinition>> | undefined {
    const configuration =
        workspace.getConfiguration('tasks', isFolder(scope) ? scope : null);
    return getIsolatedTasks(configuration, scope);
}


function getIsolatedTasks(configuration: Immutable<WorkspaceConfiguration>, scope: Immutable<Scope>): Immutable<Array<RawTaskDefinition>> | undefined {

    const inspected = configuration
        .inspect<Array<RawTaskDefinition>>('tasks');

    if (!inspected) {
        return undefined;
    }

    if (isFolder(scope)) {
        return inspected.workspaceFolderValue;
    } else if (isWorkspace(scope)) {
        return inspected.workspaceValue;
    } else if (isGlobal(scope)) {
        return inspected.globalValue;
    }

    assert.fail('The value of the specified scope could not be determined');
}


function addDefinitionToMap(
    map: Map<TaskName, TaskDefinition>,
    raw: RawTaskDefinition,
): Map<TaskName, TaskDefinition> {

    // Пропускаем записи без- или с невалидным названием.
    if (!nameIsQualifies(raw.label)) {
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
