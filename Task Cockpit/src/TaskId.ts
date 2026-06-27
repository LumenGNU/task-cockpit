import {
    workspace
} from 'vscode';
import type TaskName from './TaskName/TaskName';
import type ScopeKey from './Scope/Key';
import getKey from './Scope/getKey';
import type Definition from './Scope/TaskSource/Definitions/Definition/Definition';
import type EligibleTask from './EligibleTask/EligibleTask';


const GROUP_SEPARATOR = '\u001D#\u001D' as const;
const DISPLAY_SEPARATOR = '\u2009•\u2009' as const;


/** Строковый идентификатор задачи, уникальный в пределах
 * текущего снимка рабочей области.
 *
 * Взаимно связывает {@link EligibleTask | объект-задачу VS Code, прошедшую фильтр }
 * с соответствующим {@link Definition | определением задачи, полученным из файла задач}
 * (через идентификаторы).
 *
 * Формат: `{scopePrefix}{GroupSeparator}{taskName}`, где
 * - `scopePrefix` — либо {@linkcode ScopeKey} для глобального workspace,
 *   либо строковое представление URI папки ({@linkcode FolderKey}) для задачи из конкретной папки;
 * - `taskName` — непустое {@link TaskName имя задачи}.
 */
type TaskId = `${ScopeKey}${typeof GROUP_SEPARATOR}${TaskName}`;


const TaskId = {

    fromTask(task: Readonly<EligibleTask>): TaskId {
        return `${getKey(task.scope)}${GROUP_SEPARATOR}${task.name}`;
    },

    fromIdentifiers(scopeKey: ScopeKey, taskName: TaskName): TaskId {
        return `${scopeKey}${GROUP_SEPARATOR}${taskName}`;
    },

    print(taskId: TaskId): string {
        const [scopeKey, taskName] = taskId.split(GROUP_SEPARATOR) as [ScopeKey, TaskName];
        return `${workspace.asRelativePath(scopeKey.replaceAll('\0', ''))}${DISPLAY_SEPARATOR}${taskName}`;
    }

} as const;


export default TaskId;
