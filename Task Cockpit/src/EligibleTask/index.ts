/** @file EligibleTask/index.ts */
/** @module EligibleTask */

import {
    type Task,
    type TaskDefinition,
    TaskScope,
    workspace as VscWorkspace,
    type WorkspaceFolder
} from 'vscode';
import {
    WorkspaceKey,
    GroupSeparator,
    DisplaySeparator
} from '../constants';
import type TaskName from '../type.d/TaskName';
import type TaskId from '../type.d/TaskId';
import type FolderKey from '../type.d/FolderKey';
import type DefinitionId from '../type.d/DefinitionId';
import Cache from './Cache';


/** Задача VS Code, прошедшая фильтр: имеет не глобальный и непустой scope,
 * а также непустое имя. */
type EligibleTask = Omit<Task,
    // Свойства `scope` и `name` переопределены на более строгие типы.
    | 'scope'
    | 'name'
    // definition уточнен как возможно имеющий поле `id`
    | 'definition'
> & {
    readonly scope: TaskScope.Workspace | WorkspaceFolder;
    readonly name: TaskName;
    readonly definition: TaskDefinition & { id?: DefinitionId; };
};


declare namespace EligibleTask {

    type Index = Record<TaskId, Readonly<EligibleTask>>;

    type Cache = import('./Cache').default;

}


const EligibleTask = {

    /** Type guard: задача имеет непустое имя и scope, отличный от
     * {@linkcode TaskScope.Global Global}. */
    qualifies(task: Task): task is EligibleTask {

        // Дружим только с задачами из Workspace- и Folder-scopes,
        // и имеющих имя
        return task.scope != null &&
            task.scope !== TaskScope.Global &&
            task.name?.length > 0;
    },


    Id: {

        /** Строит {@linkcode EligibleTask.Id} из задачи, прошедшей {@linkcode EligibleTask.qualifies}. */
        from(task: Readonly<EligibleTask>): TaskId {

            return (task.scope === TaskScope.Workspace)
                ? `${WorkspaceKey}${GroupSeparator}${task.name}`
                : `${task.scope.uri.toString() as FolderKey}${GroupSeparator}${task.name}`;
        },

        print(taskId: TaskId): string {
            const [scope, name] = taskId.split(GroupSeparator) as [string, string];
            return `${VscWorkspace.asRelativePath(scope.replaceAll('\0', ''))}${DisplaySeparator}${name}`;
        }

    } as const,


    Cache: Cache

} as const;


export default EligibleTask;
