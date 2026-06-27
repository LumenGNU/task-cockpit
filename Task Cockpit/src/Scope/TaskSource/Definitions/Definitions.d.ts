import type Definition from './Definition/Definition';
import type TaskName from '../../../TaskName/TaskName';


/** Карта определений задач, проиндексированная по имени задачи ({@link TaskName}).
 *
 * - Ключ: строковое имя задачи (`label`), прошедшее валидацию.
 * - Значение: объект {@link Definition}, содержащий нормализованные поля
 *   (`group`, `icon`, `hidden`, `isBackground`).
 *
 * Особенности:
 * - Порядок записей соответствует порядку в исходном файле
 * - При наличии дубликатов ключей последние определения перезаписывают предыдущие.
 * - Карта является `ReadonlyMap`, не предполагается модификация
 *   после построения.
 *  */
type Definitions = Map<TaskName, Readonly<Definition>>;


export default Definitions;
