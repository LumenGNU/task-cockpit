import type Key from '../Scope/Key';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type Scope from '../Scope/Scope';
import type ScopeInput from './ScopeInput';


/** Снимок данных рабочей области: набор конфигураций и определений задач,
 * сгруппированных по областям (scope).
 *
 * - Каждая запись соответствует одному {@linkcode Scope} —
 *   источнику задач и настроек, присутствующему в текущем состоянии.
 * - Ключи упорядочены в соответствии с порядком полученным от VS Code,
 *   что обеспечивает стабильный и предсказуемый обход дерева.
 * - Для каждой области формируется запись; если определения задач
 *   отсутствуют или невалидны, карта определений остаётся пустой.
 *
 * Содержит полный набор данных, отражающий текущее состояние
 * источников задач рабочей области.
 */
type ProjectMap = ReadonlyMap<Key, Readonly<ScopeInput>>;


export default ProjectMap;
