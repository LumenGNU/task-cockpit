import type {
    Task as VscTask,
    TaskDefinition,
    TaskScope as VscTaskScope,
    WorkspaceFolder
} from 'vscode';
import type TaskName from './TaskName';
import type Immutable from './utils/Immutable';
import ScopeKey from './ScopeKey';



declare const ___DefinitionId: unique symbol;


type DefinitionId = EligibleTask.DefinitionId;


/** Задача VS Code, прошедшая проверку {@linkcode isEligibleTask}:
 * `scope`  — определён, `name` — валидная, не пустая строка.
 *
 * Сужает {@linkcode Task}:
 * - `scope` — сужен до без undefined
 * - `name` — сужен до {@linkcode TaskName}
 * - `definition` — расширен опциональным полем `id`
 * */
type EligibleTask = Omit<VscTask,
    | 'scope'
    | 'name'
    | 'definition'
> & {
    readonly scope: VscTaskScope.Global | VscTaskScope.Workspace | WorkspaceFolder;
    readonly name: TaskName;
    readonly definition: TaskDefinition & { id?: DefinitionId; };
};


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
function isEligibleTask(task: Immutable<VscTask>): task is Immutable<EligibleTask> {

    // Дружим только с задачами из Workspace- и Folder-scopes (а других и нет :) ),
    // и имеющих имя
    return task.scope != null &&
        task.name.length > 0;

}


function mapEligibleTasks(fetched: Immutable<Array<VscTask>>): Immutable<Map<ScopeKey, Map<TaskName, EligibleTask>>> {
    return fetched.reduce(function (map, task) {
        if (isEligibleTask(task)) {
            // Отобрать "подходящие" рантайм-задачи и проиндексировать по
            // идентификаторам (ScopeKey, TaskName),
            // пропуская "не подходящие"

            const scopeKey = getScopeKey(task);

            let taskMap = map.get(scopeKey);
            if (!taskMap) {
                taskMap = new Map();
                map.set(scopeKey, taskMap);
            }
            taskMap.set(task.name, task);
        }
        // else {
        //     // @todo trace log
        // }
        return map;
    }, new Map<ScopeKey, Map<TaskName, Immutable<EligibleTask>>>());
}


function getScopeKey(task: Immutable<EligibleTask>): ScopeKey {
    return ScopeKey.getScopeKey(task.scope);
}


declare namespace EligibleTask {
    type DefinitionId = string & {
        readonly [___DefinitionId]: never;
    };
}

const EligibleTask = {
    getScopeKey,
    isEligibleTask,
    mapEligibleTasks,
} as const;


export default EligibleTask;
