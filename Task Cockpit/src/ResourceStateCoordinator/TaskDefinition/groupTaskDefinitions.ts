import {
    Uri,
    workspace
} from 'vscode';
import * as assert from 'node:assert/strict';
import Configuration from '../../Configuration';
import OriginKey from '../../OriginKey';
import TaskName from '../../TaskName';

import type Group from './Group';
import type Icon from './Icon';
import type Immutable from '../../utils/Immutable';
import type RawTaskDefinition from './RawTaskDefinition';
import type ResourceStructure from '../ResourceStructure';
import type TaskDefinition from './TaskDefinition';
import type TaskDefinitionMap from './TaskDefinitionMap';
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
 * - Карта является `ReadonlyMap`, не предполагается модификация
 *   после построения.
 *
 * Почему:
 * VS Code при прямом запуске не запускает конкретный экземпляр из пикера — он разрешает
 * задачу заново по имени {@see probe-task-shadowing/task-shadowing.md}.
 *
 * Два уровня затенения:
 * Уровень 1 — внутри скоупа:
 * Для каждого скоупа — обход в порядке файла, last-wins по имени. Одно активное определение
 * на имя, затенённые сохраняются.
 *
 * Уровень 2 — между скоупами ({User, Workspace, Prima}):
 * User, Workspace и Prima участвуют в глобальном приоритете User > Workspace > Prima. Если в
 * User есть активное определение с именем X — оно затеняет активное определение X в Workspace
 * и Prima. Если в Workspace есть, но нет в User — затеняет Prima.
 *
 * folder[1+] в этом не участвуют — они изолированы и никого не затеняют и не затеняются.
 *
 * Карта должна отражать то, что реально запустится при прямом вызове. Для {User, Workspace, Prima}
 * реальный победитель определяется глобально, поэтому эти три скоупа — не три независимые карты,
 * а одна иерархия с одним активным на вершине. folder[1+] — действительно отдельные независимые карты.
 *
 * @param scope Область-источник определений задач
 *  */
function groupTaskDefinitions(scopeLayout: Immutable<ResourceStructure>): Immutable<Map<OriginKey, TaskDefinitionMap>> {

    const resultMap = new Map<OriginKey, TaskDefinitionMap>();

    const globalDefinitions = buildTaskDefinitionsMap(getIsolatedGlobalTasks());

    resultMap.set(OriginKey.USER, globalDefinitions);

    const workspaceDefinitions =
        scopeLayout.Workspace
            ? buildTaskDefinitionsMap(getIsolatedWorkspaceTasks())
            : null;

    if (workspaceDefinitions) {
        for (const [taskName, taskDefinitionEntry] of workspaceDefinitions) {
            if (globalDefinitions.has(taskName)) {
                assert.ok(taskDefinitionEntry.active);
                (taskDefinitionEntry.shadowed ??= []).push(taskDefinitionEntry.active);
                taskDefinitionEntry.active = null;
            }
        }

        resultMap.set(OriginKey.WORKSPACE, workspaceDefinitions);
    }


    if (scopeLayout.folders) {

        for (const folderScope of scopeLayout.folders) {
            const folderDefinitions = buildTaskDefinitionsMap(getIsolatedFolderTasks(folderScope.uri));

            if (folderScope.isPrima) {
                for (const [taskName, taskDefinitionEntry] of folderDefinitions) {
                    if (globalDefinitions.has(taskName) || workspaceDefinitions?.has(taskName)) {
                        assert.ok(taskDefinitionEntry.active);
                        (taskDefinitionEntry.shadowed ??= []).push(taskDefinitionEntry.active);
                        taskDefinitionEntry.active = null;
                    }
                }
            }

            resultMap.set(folderScope.originKey, folderDefinitions);
        }
    }

    return resultMap;

}


function buildTaskDefinitionsMap(rawArr: Array<RawTaskDefinition>): TaskDefinitionMap {

    const map: TaskDefinitionMap = new Map();
    for (const raw of rawArr) {

        if (!TaskName.nameIsQualifies(raw.label)) {
            continue;
        }

        const definition: TaskDefinition = {
            group: parseTaskGroup(raw.group),
            hidden: parseHiddenFlag(raw.hide),
            icon: parseTaskIcon(raw.icon),
            isBackground: parseBackgroundFlag(raw.isBackground),
            taskName: raw.label
        };

        // При совпадении имён определения не теряются: все складываются в массив,
        // последнее встреченное оказывается активным.
        const existing = map.get(raw.label);

        if (existing === undefined) {
            map.set(raw.label, { active: definition });
        }
        else {
            assert.ok(existing.active);
            (existing.shadowed ??= []).push(existing.active); // текущий active → в архив
            existing.active = definition;            // новый побеждает
        }
    }

    return map;
}


function getIsolatedGlobalTasks(): Array<RawTaskDefinition> {
    const configObj = workspace.getConfiguration('tasks', null);
    return Configuration.readRaw<Array<RawTaskDefinition>>(configObj, 'tasks', Configuration.IsolationMode.GlobalOnly) ?? [];
}


function getIsolatedWorkspaceTasks(): Array<RawTaskDefinition> {
    const configObj = workspace.getConfiguration('tasks', null);
    return Configuration.readRaw<Array<RawTaskDefinition>>(configObj, 'tasks', Configuration.IsolationMode.WorkspaceOnly) ?? [];
}


function getIsolatedFolderTasks(scopeUri: Immutable<Uri>): Array<RawTaskDefinition> {
    const configObj = workspace.getConfiguration('tasks', scopeUri);
    return Configuration.readRaw<Array<RawTaskDefinition>>(configObj, 'tasks', Configuration.IsolationMode.FolderOnly) ?? [];
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


export default groupTaskDefinitions;
