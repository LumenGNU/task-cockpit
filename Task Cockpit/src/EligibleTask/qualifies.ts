import {
    type Task,
    TaskScope
} from 'vscode';
import type EligibleTask from './EligibleTask';


/** Type guard: задача имеет непустое имя и scope, отличный от
 * {@linkcode TaskScope.Global Global}.
 *
 * @remarks
 * `TaskScope.Global` в API присутствует, но задач с такой областью
 *  на практике не встречается — глобальные задачи приходят с областью
 * `Workspace` и от остальных не отличаются.
 *  */
function qualifies(task: Task): task is EligibleTask {

    // Дружим только с задачами из Workspace- и Folder-scopes,
    // и имеющих имя
    return task.scope != null &&
        task.name?.length > 0 &&
        task.scope !== TaskScope.Global; // vscode api: «The task is a global task. Global tasks are currently not supported»
}


export default qualifies;
