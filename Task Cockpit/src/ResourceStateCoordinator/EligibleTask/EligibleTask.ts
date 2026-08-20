import {
    Task as VscTask,
    TaskDefinition,
    tasks as VscTasks,
    TaskScope,
    WorkspaceFolder
} from 'vscode';
import type TaskName from '../../TaskName';
import type Immutable from '../../utils/Immutable';
import type DefinitionId from './DefinitionId';


/** Type guard: задача имеет непустое имя и scope.
 *
 * @remarks
 * `TaskScope.Global` в API присутствует, но задач с такой областью
 *  выполнения на практике не встречается.
 *
 * *Из vscode api*:
 * > ~~~
 * > (enum member) TaskScope.Global = 1
 * > ~~~
 * > The task is a global task. Global tasks are currently not supported.
 *
 * Для runtime-задачи scope — это не "происхождение", а контекст выполнения.
 * Текущая архитектура VS Code все задачи выполняет в контексте "Workspace"
 * или конкретного каталога.
 *  */
function isEligibleTask(task: Immutable<VscTask>): task is Immutable<EligibleTask> {

    // Дружим только с задачами из Workspace- и Folder-scopes (а других и нет :) ),
    // и имеющих имя
    return task.scope != null &&
        task.source === 'Workspace' &&
        task.name.length > 0;

}


async function fetchTasks(): Promise<Immutable<Array<EligibleTask>>> {

    const fetched = await VscTasks.fetchTasks();
    return fetched.filter((task) => isEligibleTask(task));
}


/** Задача VS Code, прошедшая проверку {@linkcode isEligibleTask}:
 * `scope`  — определён, `name` — валидная, не пустая строка.
 *
 * Сужает {@linkcode Task}:
 * - `scope` — сужен до без undefined
 * - `name` — сужен до {@linkcode TaskName}
 * - `definition` — расширен опциональным полем `id`
 * */
type EligibleTask = Omit<VscTask,
    | 'definition'
    | 'name'
    | 'scope'
    | 'source'
> & {
    readonly definition: TaskDefinition & { id?: DefinitionId; };
    readonly name: TaskName;
    readonly scope: TaskScope.Global | TaskScope.Workspace | WorkspaceFolder;
    readonly source: 'Workspace';
};

const EligibleTask = {
    fetchTasks,
    isEligibleTask
} as const;


export default EligibleTask;
