/** @file Workspace/Definition/index.ts */
/** @module Definition */


import fetch from './Fetch';
import type Icon from '../../type.d/Icon';
import type TaskGroup from '../../type.d/TaskGroup';
import type TaskName from '../../type.d/TaskName';


/** "Описание задачи" (не сама задача), извлечённое из
 * разобранного определения задачи в файле.
 *
 * Нормализованное представление пользовательских полей
 * (с валидацией и значениями по умолчанию), минимально необходимое
 * для представления задачи в UI. */
interface Definition {

    /** Флаг скрытия из отображения */
    hidden: boolean;

    /** Пользовательская иконка */
    icon: Icon | null;

    /** Признак фонового выполнения. */
    isBackground: boolean;

    /** Группа выполнения. */
    group: TaskGroup | null;

}


declare namespace Definition {

    type ScopeMap = Readonly<Record<TaskName, Readonly<Definition>>>;

}


const Definition = {

    fetch

} as const;


export default Definition;
