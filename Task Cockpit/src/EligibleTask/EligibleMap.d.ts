import type TaskName from '../type.d/TaskName';
import type EligibleTask from './EligibleTask';
import type ScopeKey from '../Scope/Key';

/** Индекс {@link EligibleTask | "подходящих" задач} одной области видимости,
 * сгруппированных по имени задачи. */
type NameMap = ReadonlyMap<TaskName, Readonly<EligibleTask>>;

/** Индекс "{@link EligibleTask | "подходящих" задач} по всем областям видимости.
 *
 * Отсутствие ключа означает, что в данной области
 * «подходящих» задач не обнаружено. */
type EligibleMap = ReadonlyMap<ScopeKey, NameMap>;

export default EligibleMap;
