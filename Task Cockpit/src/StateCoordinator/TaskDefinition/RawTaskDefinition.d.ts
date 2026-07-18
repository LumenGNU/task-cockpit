/** Сырой объект определения задачи, извлечённый из файла-источника.
 *
 * Поля типизированы как `unknown` — валидация выполняется
 * при преобразовании в {@linkcode mapDefinitions}. */
interface RawTaskDefinition {
    /** Имя. */
    label?: unknown;
    /** Флаг скрытия. */
    hide?: unknown;
    /** Пользовательская иконка. */
    icon?: unknown;
    /** Группа (строка/объект с `kind`/`isDefault`). */
    group?: unknown;
    /** Признак фоновой. */
    isBackground?: unknown;
}

export default RawTaskDefinition;
