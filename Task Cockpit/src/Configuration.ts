/** @file Configuration.ts */
/** @module Configuration */
/** Модуль для работы с конфигурацией VS Code.
 * Обеспечивает строгую типизацию, валидацию и безопасное приведение типов (coercion).
 */

import * as vscode from 'vscode';
import * as assert from 'assert/strict';


/** Базовый интерфейс дескриптора опции.
 * @template Type Тип из перечисления {@link OptionType}.
 * @template Spec Дополнительные параметры валидации (границы, паттерны и т.д.). */
interface ConfigOption<Type extends OptionType, Spec> {
    /** Ключ в package.json или путь к секции. Если указана точка '.', используется ключ объекта. */
    readonly from: string;
    readonly type: Type;
    readonly spec: Spec;
}


/** Дескриптор логического поля (boolean). */
type BooleanOption = ConfigOption<OptionType.Boolean, {
    /** Значение по умолчанию, если в настройках записан не-boolean или ключ отсутствует. */
    readonly fallback: boolean;
}>;


/** Дескриптор числового поля.
 *
 * Логика обработки:
 * - Если значение не является числом (NaN, string, null) -> возвращается `fallback`.
 * - Если значение число, но выходит за границы `min`/`max` -> значение **clamped** (прижимается к границе).
 *
 * @example
 * spec: { fallback: 10, min: 0 }
 * // -5 -> 0 (clamped)
 * // "abc" -> 10 (fallback)
 * */
type NumberOption = ConfigOption<OptionType.Number, {
    /** Значение, возвращаемое когда настройка отсутствует или не является конечным числом. */
    readonly fallback: number;
    /** Включительная нижняя граница. Значения ниже неё обрезаются до `min`. */
    readonly min?: number;
    /** Включительная верхняя граница. Значения выше неё обрезаются до `max`. */
    readonly max?: number;
}>;


/** Дескриптор строкового поля.
 *
 * При проверке в рантайме (`get`), если значение не прошло `pattern`, будет возвращен `fallback`.
 * При создании схемы (`createSchema`), сам `fallback` также проверяется на соответствие паттерну. */
type StringOption = ConfigOption<OptionType.String, {
    /** Значение, возвращаемое когда настройка отсутствует, не является строкой или не прошла `pattern`. */
    readonly fallback: string;
    /** Регулярное выражение для валидации. */
    readonly pattern?: RegExp;
}>;


/** Дескриптор поля типа "множество строк".
 *
 * Конвертирует массив строк из настроек VS Code в нативный JS `Set<string>`.
 * Если в массиве встречаются не-строковые элементы, весь массив считается невалидным и заменяется на `fallback`.
 * *Пустой массив является валидным значением.*
 * */
type StringSetOption = ConfigOption<OptionType.StringSet, {
    /** Значение, возвращаемое когда настройка отсутствует или не является массивом. */
    readonly fallback: readonly string[];
}>;


type AnyConfigOption =
    | BooleanOption
    | NumberOption
    | StringOption
    | StringSetOption
    ;


/** Вспомогательный тип для извлечения результирующего типа из дескриптора.
 * Используется для маппинга "Схема -> Интерфейс". */
type ExtractFieldType<F> =
    F extends BooleanOption ? boolean :
    F extends NumberOption ? number :
    F extends StringOption ? string :
    F extends StringSetOption ? Set<string> :
    never;


/** Рекурсивно преобразует структуру схемы в структуру готовых данных. */
type InferConfigType<S> = {
    [K in keyof S]:
    ExtractFieldType<S[K]> extends never
    ? InferConfigType<S[K]>      // объект — идём глубже
    : ExtractFieldType<S[K]>; // FieldDef — разворачиваем
};


/** Обратный маппинг: по типу значения подбирает нужный тип дескриптора для схемы. */
type FieldDefFor<T> =
    T extends boolean ? BooleanOption :
    T extends string ? StringOption :
    T extends number ? NumberOption :
    T extends Set<string> ? StringSetOption :
    never;


/** Тег-дискриминант для дескрипторов полей конфигурации.
 *
 * Используется как свойство `type` в дескрипторах, передаваемых в {@linkcode Configuration.ConfigSchema}. */
const enum OptionType {
    /** Логическое значение */
    Boolean,
    /** Строка */
    String,
    /** Число */
    Number,
    /** Множество уникальных строк (`Set<string>`) */
    StringSet
}


declare namespace Configuration {


    /** Описывает структуру схемы на основе целевого интерфейса `I`.
     * Используется для проверки корректности объявления схемы.
     *
     * Каждый лист `I[K]` должен быть одним из {@link OptionType | известных типов}.
     *
     * Каждое свойство `I[K]` примитивного типа заменяется на соответствующий
     * `*Option`-дескриптор; вложенные объекты обходятся рекурсивно.
     *
     * Используй с оператором `satisfies`, чтобы TypeScript проверил,
     * что схема действительно описывает целевой интерфейс.
     *
     * @template I Интерфейс, описывающий итоговую типизированную конфигурацию.
     *
     * @example
     * ```ts
     * interface ICfg {
     *     node: { useIcon: boolean; label: string };
     * }
     *
     * const schema = {
     *     node: {
     *         useIcon: { from: 'myExt.node', type: OptionType.Boolean, spec: { fallback: false } },
     *         label:   { from: 'myExt.node', type: OptionType.String,  spec: { fallback: 'Task' } },
     *     }
     * } satisfies Configuration.ConfigSchema<ICfg>;
     * ``` */
    export type ConfigSchema<I> = {
        [K in keyof I]: FieldDefFor<I[K]> extends never
        ? ConfigSchema<I[K]>           // объект — идём глубже
        : FieldDefFor<I[K]>;  // примитив — оборачиваем
    };

}


// минимальная валидация-типизация конфигурации
const Configuration = {

    /** Валидирует структуру самой схемы дескрипторов.
     * Вызывает `assert`, если дескрипторы настроены противоречиво (например, fallback не входит в min/max).
     *
     * Рекомендуется вызывать один раз при инициализации расширения.
     *
     * @param schema Объект схемы.
     * @throws {AssertionError} Если схема содержит логические ошибки. */
    createSchema<SchemaInterface>(schema: Readonly<Configuration.ConfigSchema<SchemaInterface>>): typeof schema {

        function walkSchema(entry: object, path: string[] = []) {
            // Проверка на null/undefined
            assert.ok(entry != null,
                `Schema entry at ${path.join('.')} is null or undefined`);

            for (const [key, field] of Object.entries(entry)) {

                const currentPath = [...path, key];

                if (isFieldDef(field)) {
                    // Базовые проверки структуры
                    assert.ok(field.from.length,
                        `Field path is empty at ${currentPath.join('.')}`);
                    assert.ok(field.spec != null,
                        `Field spec is missing at ${currentPath.join('.')}`);
                    assert.ok(field.spec.fallback != null,
                        `Missing mandatory 'fallback' value in field spec at ${currentPath.join('.')}`);

                    switch (field.type) {

                        case OptionType.Boolean: {

                            assert.ok(typeof field.spec.fallback === 'boolean',
                                `Invalid fallback type at ${currentPath.join('.')}: expected "boolean" got "${typeof field.spec.fallback}"`);

                            break;
                        }

                        case OptionType.String: {

                            assert.ok(typeof field.spec.fallback === 'string',
                                `Invalid fallback type at ${currentPath.join('.')}: expected "string" got "${typeof field.spec.fallback}"`);

                            const { fallback, pattern } = field.spec;
                            if (pattern) {
                                // если есть паттерн —
                                // прогоняем fallback через проверку
                                assert.ok(pattern.test(fallback),
                                    `Default value "${fallback}" does not match pattern at ${currentPath.join('.')}`);
                            }
                            break;
                        }

                        case OptionType.Number: {

                            assert.ok(typeof field.spec.fallback === 'number',
                                `Invalid fallback type at ${currentPath.join('.')}: expected "number" got "${typeof field.spec.fallback}"`);

                            const { min, fallback, max } = field.spec;

                            if ((min != null) && (max != null)) {
                                assert.ok(min <= max,
                                    `Min (${min}) is greater than max (${max}) at ${currentPath.join('.')}`);
                            }
                            if (min != null) {
                                assert.ok(Number.isFinite(min),
                                    `Min is not a finite number at ${currentPath.join('.')}`);
                                assert.ok(fallback >= min,
                                    `Fallback (${fallback}) is less than min (${min}) at ${currentPath.join('.')}`);
                            }
                            if (max != null) {
                                assert.ok(Number.isFinite(max),
                                    `Max is not a finite number at ${currentPath.join('.')}`);
                                assert.ok(fallback <= max,
                                    `Fallback (${fallback}) is greater than max (${max}) at ${currentPath.join('.')}`);
                            }
                            break;
                        }

                        case OptionType.StringSet: {

                            assert.ok(Array.isArray(field.spec.fallback),
                                `Invalid fallback type at ${currentPath.join('.')}: expected "Array" got "${typeof field.spec.fallback}"`);

                            const badIdx = field.spec.fallback.findIndex(item => typeof item !== 'string');

                            assert.ok(badIdx === -1,
                                `Invalid fallback item at ${currentPath.join('.')}[${badIdx}]: expected "string" got "${typeof field.spec.fallback[badIdx]}"`);

                            break;
                        }

                        default:
                            const _: never = field;
                            assert.fail(`Unhandled option type at ${currentPath.join('.')}`);
                    }

                }
                else if (field !== null && typeof field === 'object' && !Array.isArray(field)) {
                    // Рекурсивный обход вложенных объектов
                    walkSchema(field, currentPath);
                    // @fixme
                    // обект должен либо содержать спеки, либо объекты
                    // содержащие спеки - ничего левого
                }
                else {
                    assert.fail(`Invalid schema structure at ${path.join('.')}: ` +
                        `expected a nested object or FieldDefinition, but found ${currentPath.join('.')}: ${typeof field}.`);
                }

            }

            return entry;
        }

        return walkSchema(schema) as typeof schema;
    },

    /** Читает настройки из VS Code и применяет правила валидации согласно схеме.
     *
     * **Контракт:**
     * - Метод никогда не бросает исключений (при ошибках данных возвращается `fallback`).
     * - Структура результата всегда соответствует структуре схемы.
     * - Все числовые значения будут в рамках заданных границ (clamped).
     *
     * @template S Тип схемы.
     * @param {S} schema Объект, {@linkcode Configuration.ConfigSchema | описывающий структуру и правила валидации},
     *   полученный через {@linkcode Configuration.createSchema}.
     * @param workspaceConfig Экземпляр `vscode.WorkspaceConfiguration`.
     * @returns Объект, зеркально повторяющий структуру схемы, с валидными значениями,
     *   приведёнными к соответствующим типам и границам.
     *
     *  */
    get<S extends object>(schema: S, workspaceConfig: Readonly<vscode.WorkspaceConfiguration>): InferConfigType<S> {

        // Обход в поисках спеки

        function walkSchema(entry: object) {

            const result = Object.create(null);

            for (const [key, field] of Object.entries(entry)) {

                if (isFieldDef(field)) {

                    result[key] = resolveFieldValue(key, field, workspaceConfig);

                } else if (typeof field === 'object' && field !== null) {

                    result[key] = walkSchema(field);
                }
            }

            return result;
        }

        return walkSchema(schema);
    }

} as const;


/**  Извлекает значение из VS Code, учитывая путь префикса.
 * Если `fieldDef.from` равно '.', поиск идет напрямую по имени ключа в объекте.
 * */
function resolveFieldValue(configKey: string, fieldDef: Readonly<AnyConfigOption>, workspaceConfig: vscode.WorkspaceConfiguration) {

    const input = workspaceConfig.get(fieldDef.from === '.' ? configKey : `${fieldDef.from}.${configKey}`);

    switch (fieldDef.type) {

        case OptionType.Boolean: {
            return coerceBoolean(input, fieldDef.spec);
        }
        case OptionType.Number: {
            return coerceNumber(input, fieldDef.spec);
        }
        case OptionType.String: {
            return coerceString(input, fieldDef.spec);
        }
        case OptionType.StringSet: {
            return coerceStringSet(input, fieldDef.spec);
        }

        default:
            const _spec: never = fieldDef;
            throw _spec;
    };
}


/** Type guard для определения, является ли ветка схемы конечным дескриптором. */
function isFieldDef(value: unknown): value is AnyConfigOption {
    return (
        value != null &&
        typeof value === 'object' &&
        'from' in value &&
        'type' in value &&
        'spec' in value
    );
}


// -----
// #region Валидаторы (Coercion Logic)

function coerceNumber(
    value: unknown,
    {
        fallback,
        min,
        max
    }: {
        readonly fallback: number;
        readonly min?: number | undefined;
        readonly max?: number | undefined;
    }
): number {

    if (typeof value !== 'number' || !isFinite(value)) {
        return fallback;
    }

    if (min != null && value < min) {
        return min;
    }

    if (max != null && value > max) {
        return max;
    }

    return value;
}


function coerceBoolean(
    value: unknown,
    {
        fallback
    }: {
        readonly fallback: boolean;
    }
): boolean {

    return typeof value === 'boolean' ? value : fallback;
}

// @todo строки от vscode приходят в дебильном виде (экранирование/спецсимволы)
function coerceString(
    value: unknown,
    {
        fallback,
        pattern
    }: {
        readonly fallback: string;
        readonly pattern?: RegExp;
    }
): string {

    if (typeof value !== 'string') return fallback;
    if (pattern != null && !pattern.test(value)) return fallback;

    return value;
}


function coerceStringSet(
    value: unknown,
    { fallback }: { readonly fallback: readonly string[]; }
): Set<string> {

    if (!Array.isArray(value)) return new Set(fallback);
    if (value.some(item => typeof item !== 'string')) return new Set(fallback);

    return new Set(value);
}

// #endregion Валидаторы


export default Configuration;
export {
    OptionType,
    NumberOption,
    StringOption,
    BooleanOption,
    StringSetOption
};
