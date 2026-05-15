/** @file TaskIndex/EligibleTask.ts */
/** @module EligibleTask */

import * as vscode from 'vscode';
import {
    WorkspaceKey,
    GroupSeparator,
    DisplaySeparator
} from './constants';
import type { TaskName } from './type.d/TaskName';
import type { TaskId } from './type.d/TaskId';
import type { FolderKey } from './type.d/FolderKey';
import type { DefinitionId } from './type.d/DefinitionId';


/** Задача VS Code, прошедшая фильтр: имеет не глобальный и непустой scope,
 * а также непустое имя. */
type EligibleTask = Omit<vscode.Task,
    // Свойства `scope` и `name` переопределены на более строгие типы.
    | 'scope'
    | 'name'
> & {
    readonly scope: vscode.TaskScope.Workspace | vscode.WorkspaceFolder;
    readonly name: TaskName;
    readonly definition: vscode.TaskDefinition & { id?: DefinitionId; };
};


const EligibleTask = {

    /** Type guard: задача имеет непустое имя и scope, отличный от
     * {@linkcode vscode.TaskScope.Global Global}. */
    qualifies(task: vscode.Task): task is EligibleTask {

        // Дружим только с задачами из Workspace- и Folder-scopes,
        // и имеющих имя
        return task.scope != null &&
            task.scope !== vscode.TaskScope.Global &&
            task.name?.length > 0;
    },


    Id: {

        /** Строит {@linkcode EligibleTask.Id} из задачи, прошедшей {@linkcode EligibleTask.qualifies}. */
        from(task: Readonly<EligibleTask>): TaskId {

            return (task.scope === vscode.TaskScope.Workspace)
                ? `${WorkspaceKey}${GroupSeparator}${task.name}`
                : `${task.scope.uri.toString() as FolderKey}${GroupSeparator}${task.name}`;
        },

        print(taskId: TaskId): string {
            const [scope, name] = taskId.split(GroupSeparator) as [string, string];
            return `${vscode.workspace.asRelativePath(scope.replaceAll('\0', ''))}${DisplaySeparator}${name}`;
        },

    } as const,

} as const;



export default EligibleTask;
