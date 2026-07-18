import type TaskName from '../../TaskName/TaskName';
import type EligibleTask from './EligibleTask';
import type ScopeKey from '../../Scope/Key';

/** Индекс {@link EligibleTask | "подходящих" задач} одной области видимости,
 * сгруппированных по имени задачи. */
type NameMap = Map<TaskName, EligibleTask>;

/** Индекс "{@link EligibleTask | "подходящих" задач} по всем областям видимости.
 *
 * Отсутствие ключа означает, что в данной области
 * «подходящих» задач не обнаружено. */
type EligibleMap = Map<ScopeKey, NameMap>;

export default EligibleMap;
