import * as vscode from 'vscode';
import type * as TC from '../../types';
import {
    WORKSPACE_KEY,
    GROUP_SEPARATOR
} from '../../constants';


/** Задача VS Code, прошедшая фильтр: имеет не глобальный и непустой scope,
 * а также непустое имя. */
type EligibleTask = Omit<vscode.Task,
    // Свойства `scope` и `name` переопределены на более строгие типы.
    | 'scope'
    | 'name'
> & {
    readonly scope: vscode.TaskScope.Workspace | vscode.WorkspaceFolder;
    readonly name: TC.TaskName;
};

declare namespace EligibleTask {
    type Id = TC.TaskId;
}

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
        from(task: Readonly<EligibleTask>): TC.TaskId {

            return (task.scope === vscode.TaskScope.Workspace)
                ? `${WORKSPACE_KEY}${GROUP_SEPARATOR}${task.name}`
                : `${task.scope.uri.toString() as TC.FolderKey}${GROUP_SEPARATOR}${task.name}`;
        },

    } as const,

} as const;



export default EligibleTask;
