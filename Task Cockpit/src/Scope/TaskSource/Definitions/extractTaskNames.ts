import type Definition from './Definition/Definition';
import type Definitions from './Definitions';
import type TaskName from '../../../type.d/TaskName';


/** Извлекает имена задач из карты определений.
 *
 * Без предиката возвращает все ключи карты в порядке вставки.
 * С предикатом — только имена, для которых предикат вернул `true`.
 *
 * @param definitions Карта определений задач.
 * @param predicate Необязательный фильтр: принимает имя задачи и её определение,
 *   возвращает `true` если имя задачи нужно включить в результат.
 * @returns Массив {@link TaskName} в порядке обхода карты. */
function extractTaskNames(
    definitions: Readonly<Definitions>,
    predicate?: (name: TaskName, definition: Definition) => boolean
): Array<TaskName> {

    if (!predicate) {
        return [...definitions.keys()];
    }

    const names: Array<TaskName> = [];
    for (const [taskName, definition] of definitions) {
        if (predicate(taskName, definition)) {
            names.push(taskName);
        }
    }
    return names;
};

export default extractTaskNames;
