import type TaskName from '../type.d/TaskName';
import type ScopeKey from '../Scope/Key';
import DefinitionId from '../EligibleTask/DefinitionId';


/** Набор закреплённых задач в пределах одного scope.
 *
 * Ключ — пользовательское имя задачи (`TaskName`).
 * Значение — `DefinitionId` на момент закрепления (или `null`, если
 * идентификатор неизвестен). Используется для стабилизации ссылки
 * на задачу при повторном перестроении списка задач (ре-сканировании
 * workspace и т.п.). */
type NameMap = ReadonlyMap<TaskName, DefinitionId | null>;


/** Формат хранилища: scope → набор пинов.
 *
 * Инвариант: пустых `Refs` в хранилище не бывает — при последнем
 * удалении пина scope удаляется из объекта целиком. */
type PinMap = ReadonlyMap<ScopeKey, NameMap>;


export default PinMap;
