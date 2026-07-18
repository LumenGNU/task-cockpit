import type {
    Task,
    TaskDefinition,
} from 'vscode';
import type DefinitionId from './DefinitionId';
import type TaskName from '../../TaskName/TaskName';
import type Scope from '../../Scope/Scope';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type isEligibleTask from './isEligibleTask';


/** Задача VS Code, прошедшая проверку {@linkcode isEligibleTask}:
 * `scope`  — определён, `name` — валидная, не пустая строка.
 *
 * Сужает {@linkcode Task}:
 * - `scope` — сужен до {@linkcode Scope}
 * - `name` — сужен до {@linkcode TaskName}
 * - `definition` — расширен опциональным полем `id`
 * */
type EligibleTask = Omit<Task,
    | 'scope'
    | 'name'
    | 'definition'
> & {
    readonly scope: Scope;
    readonly name: TaskName;
    readonly definition: TaskDefinition & { id?: DefinitionId; };
};


export default EligibleTask;
