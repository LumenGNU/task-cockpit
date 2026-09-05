/** Сырой объект определения задачи, извлечённый из файла-источника.
 *
 * Поля типизированы как `unknown` — валидация выполняется
 * при преобразовании в {@linkcode mapDefinitions}. */
interface RawTaskDefinition {
    /** Группа (строка/объект с `kind`/`isDefault`). */
    group?: unknown;
    /** Флаг скрытия. */
    hide?: unknown;
    /** Пользовательская иконка. */
    icon?: unknown;
    /** Признак фоновой. */
    isBackground?: unknown;
    /** Имя. */
    label?: unknown;
}

export default RawTaskDefinition;
