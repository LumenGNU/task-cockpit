/** Модуль для работы с конфигурацией VS Code.
 * Обеспечивает строгую типизацию, валидацию и безопасное приведение типов (coercion).
 */

import * as vscode from 'vscode';
import * as assert from 'assert/strict';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AssertionError } from 'assert/strict';


/** Базовый интерфейс дескриптора опции.
 * @template Type Тип из перечисления {@link OptionType}.
 * @template Spec Дополнительные параметры валидации (границы, паттерны и т.д.). */
interface ConfigOption<Type extends OptionType, Spec> {
    /** Ключ в package.json или путь к секции. Если указана точка '.', используется ключ объекта. */
    readonly from: string;
    /** Тип получаемого значения */
    readonly type: Type;
    /** Параметры валидации */
    readonly spec: Spec;
}


interface BooleanSpec {
    /** Значение по умолчанию, если в настройках записан не-boolean или ключ отсутствует. */
    readonly fallback: boolean;
}


interface NumberSpec {
    /** Значение, возвращаемое когда настройка отсутствует или не является конечным числом. */
    readonly fallback: number;
    /** Включительная нижняя граница. Значения ниже неё обрезаются до `min`. */
    readonly min?: number;
    /** Включительная верхняя граница. Значения выше неё обрезаются до `max`. */
    readonly max?: number;
}


interface StringSpec {
    /** Значение, возвращаемое когда настройка отсутствует, не является строкой или не прошла `pattern`. */
    readonly fallback: string;
    /** Регулярное выражение для валидации. */
    readonly pattern?: RegExp;
}


interface StringSetSpec {
    /** Значение, возвращаемое когда настройка отсутствует или не является массивом. */
    readonly fallback: readonly string[];
}


interface StringLiteralSpec<T extends string> {
    readonly fallback: T;
    readonly values: readonly T[];  // для валидации в рантайме
}


/** Вспомогательный тип для извлечения результирующего типа из дескриптора.
 * Служит для получения интерфейса на основе схемы. (Схема → Интерфейс) */
type ExtractFieldType<F> =
    F extends Configuration.BooleanOption ? boolean :
    F extends Configuration.NumberOption ? number :
    F extends Configuration.StringLiteralOption<infer T> ? T :  // до StringOption!
    F extends Configuration.StringOption ? string :
    F extends Configuration.StringSetOption ? Set<string> :
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
    [T] extends [number] ? Configuration.NumberOption :
    [T] extends [boolean] ? Configuration.BooleanOption :
    [string] extends [T] ? Configuration.StringOption :      // T ровно string, не сужение
    [T] extends [string] ? Configuration.StringLiteralOption<T> :  // литерал/union
    [T] extends [Set<string>] ? Configuration.StringSetOption :
    never;


/** Тег-дискриминант для дескрипторов полей конфигурации.
 *
 * Используется как свойство `type` в дескрипторах, передаваемых в {@linkcode Configuration.ConfigSchema}. */
enum OptionType {

    /** Логическое значение */
    Boolean,

    /** Строка */
    String,

    /** Число */
    Number,

    /** Множество уникальных строк (`Set<string>`) */
    StringSet,

    /** Union перечисление */
    StringLiteral
}


declare namespace Configuration {

    /** Дескриптор логического поля (boolean). */
    type BooleanOption = ConfigOption<OptionType.Boolean, BooleanSpec>;


    /** Дескриптор числового поля.
     *
     * Логика обработки:
     * - Если значение не является числом (NaN, string, null) -> возвращается `fallback`.
     * - Если значение число, но выходит за границы `min`/`max` -> значение **clamped** (прижимается к границе).
     *
     * @example
     * ~~~
     * spec: { fallback: 10, min: 0 }
     * // -5 -> 0 (clamped)
     * // "abc" -> 10 (fallback)
     * ~~~
     * */
    type NumberOption = ConfigOption<OptionType.Number, NumberSpec>;


    /** Дескриптор строкового поля.
     *
     * При проверке в рантайме (`get`), если значение не прошло `pattern`, будет возвращен `fallback`.
     * При создании схемы (`createSchema`), сам `fallback` также проверяется на соответствие паттерну. */
    type StringOption = ConfigOption<OptionType.String, StringSpec>;


    /** Дескриптор поля типа "множество строк".
     *
     * Конвертирует массив строк из настроек VS Code в нативный JS `Set<string>`.
     * Если в массиве встречаются не-строковые элементы, весь массив считается невалидным и заменяется на `fallback`.
     * *Пустой массив является валидным значением.*
     * */
    type StringSetOption = ConfigOption<OptionType.StringSet, StringSetSpec>;


    type StringLiteralOption<T extends string> = ConfigOption<OptionType.StringLiteral, StringLiteralSpec<T>>;


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


function isKVObject(entry: unknown): entry is { [k: string]: unknown; } {
    return (
        entry != null &&
        typeof entry === 'object' &&
        !Array.isArray(entry)
    );
}

/** Type guard для определения, является ли ветка схемы конечным дескриптором. */
function isFieldDef(entry: { [k: string]: unknown; }): entry is { from: string; type: OptionType; spec: object; } {
    return (
        'from' in entry && typeof entry.from === 'string' &&
        'type' in entry && typeof entry.type === 'number' &&
        'spec' in entry && entry.spec !== null && typeof entry.spec === 'object' && !Array.isArray(entry.spec)
    );
}

function isSpec(entry: object): entry is { [k: string]: unknown; fallback: unknown; } {
    return 'fallback' in entry && entry.fallback != null;
}

// минимальная валидация-типизация конфигурации
const Configuration = {

    /** Валидирует структуру самой схемы дескрипторов.
     * Вызывает `assert`, если дескрипторы настроены противоречиво (например, fallback не входит в min/max).
     *
     * Рекомендуется вызывать один раз при инициализации расширения.
     *
     * @param schema Объект схемы.
     * @throws { AssertionError } Если схема содержит логические ошибки. */
    createSchema<S extends object>(schema: Readonly<Configuration.ConfigSchema<S>>): typeof schema {

        function walkSchema(entry: unknown, path: string[] = []) {

            if (isKVObject(entry)) {

                if (isFieldDef(entry)) {
                    assert.ok(entry.from.length,
                        `Field path is empty at ${path.join('.')}`);
                    assert.ok(isSpec(entry.spec),
                        `Field spec is corrupted at ${path.join('.')}`);

                    // ---

                    switch (entry.type) {

                        case OptionType.Boolean: {

                            assert.ok(typeof entry.spec.fallback === 'boolean',
                                `Invalid fallback type at ${path.join('.')}: expected "boolean" got "${typeof entry.spec.fallback}"`);

                            break;
                        }

                        case OptionType.String: {

                            assert.ok(typeof entry.spec.fallback === 'string',
                                `Invalid fallback type at ${path.join('.')}: expected "string" got "${typeof entry.spec.fallback}"`);

                            const { fallback, pattern } = entry.spec;
                            if (pattern) {
                                assert.ok(pattern instanceof RegExp,
                                    `Invalid pattern at ${path.join('.')}: expected "RegExp" got "${typeof pattern}"`);

                                // @reject: new RegExp('').source → '(?:)'
                                // - assert.ok(pattern.source.length > 0, // не достижимо?
                                // -    `Empty RegExp pattern at ${path.join('.')}`);

                                // если есть паттерн —
                                // прогоняем fallback через проверку
                                assert.ok(pattern.test(fallback),
                                    `Default value "${fallback}" does not match pattern at ${path.join('.')}`);
                            }
                            break;
                        }

                        case OptionType.Number: {

                            assert.ok(typeof entry.spec.fallback === 'number',
                                `Invalid fallback type at ${path.join('.')}: expected "number" got "${typeof entry.spec.fallback}"`);

                            assert.ok(Number.isFinite(entry.spec.fallback),
                                `Invalid fallback value at ${path.join('.')}: expected finite number, got ${entry.spec.fallback}`);

                            const { min, fallback, max } = entry.spec;

                            if (min != null) {
                                assert.ok(typeof min === 'number',
                                    `Min is not a number at ${path.join('.')}`);
                                assert.ok(Number.isFinite(min),
                                    `Min is not a finite number at ${path.join('.')}`);
                            }

                            if (max != null) {
                                assert.ok(typeof max === 'number',
                                    `Max is not a number at ${path.join('.')}`);
                                assert.ok(Number.isFinite(max),
                                    `Max is not a finite number at ${path.join('.')}`);
                            }

                            if ((min != null) && (max != null)) {
                                assert.ok(min <= max,
                                    `Min (${min}) is greater than max (${max}) at ${path.join('.')}`);
                            }
                            if (min != null) {
                                assert.ok(fallback >= min,
                                    `Fallback (${fallback}) is less than min (${min}) at ${path.join('.')}`);
                            }
                            if (max != null) {
                                assert.ok(fallback <= max,
                                    `Fallback (${fallback}) is greater than max (${max}) at ${path.join('.')}`);
                            }
                            break;
                        }

                        case OptionType.StringSet: {

                            assert.ok(Array.isArray(entry.spec.fallback),
                                `Invalid fallback type at ${path.join('.')}: expected "Array" got "${typeof entry.spec.fallback}"`);

                            const badIdx = entry.spec.fallback.findIndex(item => typeof item !== 'string');

                            assert.ok(badIdx === -1,
                                `Invalid fallback item at ${path.join('.')}[${badIdx}]: expected "string" got "${typeof entry.spec.fallback[badIdx]}"`);

                            break;
                        }

                        case OptionType.StringLiteral: {

                            // spec должен содержать values: readonly string[] и fallback: string
                            assert.ok(Array.isArray(entry.spec.values),
                                `Invalid values at ${path.join('.')}: expected Array of strings`);
                            const badIdx = entry.spec.values.findIndex(v => typeof v !== 'string' || v.length === 0);
                            assert.ok(badIdx === -1,
                                `Invalid literal value at ${path.join('.')}[${badIdx}]: expected non-empty string`);
                            assert.ok(typeof entry.spec.fallback === 'string',
                                `Invalid fallback type at ${path.join('.')}: expected "string" got "${typeof entry.spec.fallback}"`);
                            assert.ok((entry.spec.values as readonly string[]).includes(entry.spec.fallback),
                                `Fallback "${entry.spec.fallback}" is not included in values at ${path.join('.')}`);
                            break;
                        }

                        default: {
                            const _: never = entry.type;
                            assert.fail(`Unhandled option type at ${path.join('.')}`);
                        }
                    }

                }
                else {
                    for (const key in entry) {
                        walkSchema(entry[key], [...path, key]);
                    }
                }
            }
            else {
                assert.fail(`Invalid schema structure at ${path.slice(0, -1).join('.')} expected ConfigOption object`);
            }

            return entry;
        }

        return walkSchema(schema) as typeof schema;
    },

    /** Читает настройки полученные от VS Code и применяет правила валидации согласно схеме.
     *
     * **Контракт:**
     * - Метод никогда не бросает исключений (при ошибках данных возвращается `fallback`)
     * - Структура результата всегда соответствует структуре схемы
     * - Все значения будут присутствовать
     * - Все числовые значения будут в рамках заданных границ (clamped)
     *
     * @template S Тип схемы.
     * @param {S} schema Объект, {@link Configuration.ConfigSchema описывающий структуру и правила валидации},
     *   полученный через {@linkcode Configuration.createSchema}.
     * @param workspaceConfig Экземпляр `vscode.WorkspaceConfiguration`.
     * @returns Объект, зеркально повторяющий структуру схемы, с валидными значениями,
     *   приведёнными к соответствующим типам и границам.
     *
     *  */
    get<Schema extends object>(
        schema: Readonly<Schema>,
        workspaceConfig: Readonly<vscode.WorkspaceConfiguration>
    ): InferConfigType<Schema> {

        // Обход в поисках спеки

        function walkSchema(entry: { [k: string]: unknown; }) {

            const result = Object.create(null) as { [k: string]: unknown; };

            for (const [key, field] of Object.entries(entry)) {

                if (!isKVObject(field)) {
                    continue;
                }

                if (isFieldDef(field)) {
                    result[key] = resolveFieldValue(key, field, workspaceConfig);
                }
                else {
                    result[key] = walkSchema(field);
                }
            }

            return result;
        }

        return walkSchema(schema) as InferConfigType<Schema>;
    }

} as const;


/**  Извлекает значение из VS Code, учитывая путь префикса.
 * Если `fieldDef.from` равно '.', поиск идет напрямую по имени ключа в объекте.
 * */
function resolveFieldValue(configKey: string, fieldDef: {
    from: string;
    type: OptionType;
    spec: object;
}, workspaceConfig: vscode.WorkspaceConfiguration) {

    const input = workspaceConfig.get(fieldDef.from === '.' ? configKey : `${fieldDef.from}.${configKey}`);

    switch (fieldDef.type) {

        case OptionType.Boolean: {
            return coerceBoolean(input, fieldDef.spec as BooleanSpec);
        }
        case OptionType.Number: {
            return coerceNumber(input, fieldDef.spec as NumberSpec);
        }
        case OptionType.String: {
            return coerceString(input, fieldDef.spec as StringSpec);
        }
        case OptionType.StringSet: {
            return coerceStringSet(input, fieldDef.spec as StringSetSpec);
        }
        case OptionType.StringLiteral: {
            return coerceStringLiteral(input, fieldDef.spec as StringLiteralSpec<string>);
        }

        default: {
            const _spec: never = fieldDef.type;
            throw new Error(_spec);
        }
    }
};


// -----
// #region Валидаторы (Coercion Logic)

function coerceNumber(
    value: unknown,
    spec: NumberSpec
): number {

    if (typeof value !== 'number' || !isFinite(value)) {
        return spec.fallback;
    }

    if (spec.min != null && value < spec.min) {
        return spec.min;
    }

    if (spec.max != null && value > spec.max) {
        return spec.max;
    }

    return value;
}


function coerceBoolean(
    value: unknown,
    boolSpec: BooleanSpec
): boolean {

    return typeof value === 'boolean' ? value : boolSpec.fallback;
}


function coerceString(
    value: unknown,
    stringSpec: StringSpec
): string {

    if (typeof value !== 'string') {
        return stringSpec.fallback;
    }
    if (stringSpec.pattern != null && !stringSpec.pattern.test(value)) {
        return stringSpec.fallback;
    }

    return value;
}


function coerceStringSet(
    value: unknown,
    stringSetSpec: StringSetSpec
): Set<string> {

    if (!Array.isArray(value)) {
        return new Set(stringSetSpec.fallback);
    }
    if (value.some(item => typeof item !== 'string')) {
        return new Set(stringSetSpec.fallback);
    }

    return new Set(value as string[]);
}


function coerceStringLiteral<T extends string>(value: unknown, spec: StringLiteralSpec<T>): T {
    return (typeof value === 'string' && (spec.values as readonly string[]).includes(value))
        ? value as T
        : spec.fallback;
}

// #endregion Валидаторы


export {
    Configuration,
    OptionType
};
