import type { Icon } from './Icon';
import type { TaskGroup } from './TaskGroup';
import type { TaskName } from './TaskName';


/** "Описание задачи" (не сама задача), извлечённое из
 * разобранного определения задачи в файле.
 *
 * Нормализованное представление пользовательских полей
 * (с валидацией и значениями по умолчанию), минимально необходимое
 * для представления задачи в UI. */
interface Definition {

    [key: string]: unknown;

    /** Флаг скрытия из отображения */
    hidden: boolean;

    /** Пользовательская иконка */
    icon: Icon | null;

    /** Признак фонового выполнения. */
    isBackground: boolean;

    /** Группа выполнения. */
    group: TaskGroup | null;

    /** Имя */
    name: TaskName;

}


export { Definition };
