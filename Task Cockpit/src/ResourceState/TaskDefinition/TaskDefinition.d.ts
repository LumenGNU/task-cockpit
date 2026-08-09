
import TaskName from '../../TaskName';
import type Icon from './Icon';
import type TaskGroup from './TaskGroup';

/** "Описание задачи" (не сама задача), извлечённое из
 * разобранного определения задачи в файле-источнике.
 *
 * Нормализованное представление пользовательских полей
 * (с валидацией и значениями по умолчанию), минимально необходимое
 * для представления задачи в UI. */
interface TaskDefinition {

    taskName: TaskName;

    /** Флаг скрытия из отображения */
    hidden: boolean;

    /** Пользовательская иконка */
    icon: Icon | null;

    /** Признак фонового выполнения. */
    isBackground: boolean;

    /** Группа выполнения. */
    group: TaskGroup | null;

}

export default TaskDefinition;

