import {
    type Task,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type TaskScope
} from 'vscode';
import type EligibleTask from './EligibleTask';


/** Type guard: задача имеет непустое имя и scope, отличный от
 * {@linkcode TaskScope.Global Global}.
 *
 * @remarks
 * `TaskScope.Global` в API присутствует, но задач с такой областью
 *  на практике не встречается — глобальные задачи приходят с областью
 * `Workspace` и от остальных не отличаются.
 *
 * *Из vscode api*:
 * > ~~~
 * > (enum member) TaskScope.Global = 1
 * > ~~~
 * > The task is a global task. Global tasks are currently not supported.
 *  */
function isEligibleTask(task: Task): task is EligibleTask {

    // Дружим только с задачами из Workspace- и Folder-scopes (а других и нет :) ),
    // и имеющих имя
    return task.scope != null &&
        task.name?.length > 0;

}


export default isEligibleTask;
