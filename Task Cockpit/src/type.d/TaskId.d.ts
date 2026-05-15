import type { GroupSeparator } from '../constants';
import type { TaskName } from './TaskName';
import type { ScopeKey } from './ScopeKey';

/** Строковый идентификатор задачи, уникальный в пределах
 * текущего снимка рабочей области.
 *
 * Взаимно связывает {@link _EligibleTask | объект-задачу VS Code, прошедшую фильтр }
 * с соответствующим {@link _Definition | определением задачи, полученным из файла задач}.
 *
 * Формат: `{scopePrefix}{GroupSeparator}{taskName}`, где
 * - `scopePrefix` — либо {@linkcode WorkspaceKey} для глобального workspace,
 *   либо строковое представление URI папки ({@linkcode FolderKey}) для задачи из конкретной папки;
 * - `taskName` — непустое {@link TaskName имя задачи}.
 */
export type TaskId = `${ScopeKey}${GroupSeparator}${TaskName}`;
