import * as vscode from 'vscode';
import type TC from "./types";


interface ConfigOption<Type extends OptionType, Spec> {
    readonly path: string;
    readonly type: Type;
    readonly spec: Spec;
}


/** Дескриптор булева поля конфигурации. */
type BooleanOption = ConfigOption<OptionType.Boolean, {
    /** Значение, возвращаемое когда настройка отсутствует или имеет неверный тип. */
    readonly fallback: boolean;
}>;


/** Дескриптор числового поля конфигурации.
 *
 * Если сырое значение отсутствует или не является конечным числом, возвращается `fallback`.
 * Когда заданы границы `min`/`max`, значения вне диапазона **обрезаются** до ближайшей границы,
 * а не заменяются на `fallback`.
 *
 * @example
 * spec: { fallback: 10, min: 0, max: 100 }
 * // Значение из конфига   | Результат
 * // --------------------- | --------
 * // 42                    | 42
 * // -5                    | 0   (обрезано)
 * // 150                   | 100 (обрезано)
 * // "abc"                 | 10  (fallback)
 * // undefined             | 10  (fallback) */
type NumberOption = ConfigOption<OptionType.Number, {
    /** Значение, возвращаемое когда настройка отсутствует или не является конечным числом. */
    readonly fallback: number;
    /** Включительная нижняя граница. Значения ниже неё обрезаются до `min`. */
    readonly min?: number;
    /** Включительная верхняя граница. Значения выше неё обрезаются до `max`. */
    readonly max?: number;
}>;


/** Дескриптор строкового поля конфигурации.
 *
 * pattern и fallback: для значения fallback **не происходит проверка** на pattern.
 * Если fallback сам не соответствует паттерну (ошибка разработчика),
 * то на выходе будет невалидная строка. */
type StringOption = ConfigOption<OptionType.String, {
    /** Значение, возвращаемое когда настройка отсутствует, не является строкой или не прошла `pattern`. */
    readonly fallback: string;
    /** Опциональный паттерн валидации. Сырое значение проверяется по нему;
     * если проверка не прошла — используется `fallback`. */
    readonly pattern?: RegExp;
}>;


/** Дескриптор поля конфигурации типа "множество строк".
 *
 * Сырое значение должно быть массивом; все элементы, не являющиеся строками, молча отбрасываются.
 *
 * **Пустой массив считается корректным значением** – он не приводит к использованию `fallback`.
 * В том числе когда пустой массив получается после фильтрации. (@todo норм поведение?)
 * `fallback` применяется только если сырое значение отсутствует или не является массивом.
 *
 * @example
 * spec: { fallback: ['a', 'b'] }
 * // Значение из конфига    | Результат
 * // ---------------------- | --------
 * // value: ['x', 123, 'y'] | Set { 'x', 'y' }
 * // value: []              | Set {}
 * // value: "not array"     | Set { 'a', 'b' }
 */
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


// Инверсия TypeSpecAlias: FieldDef → примитив
type ExtractFieldType<F> =
    F extends BooleanOption ? boolean :
    F extends NumberOption ? number :
    F extends StringOption ? string :
    F extends StringSetOption ? Set<string> :
    never;


// Рекурсивный unwrap всего дерева
type InferConfigType<S> = {
    [K in keyof S]:
    ExtractFieldType<S[K]> extends never
    ? InferConfigType<S[K]>      // объект — идём глубже
    : ExtractFieldType<S[K]>; // FieldDef — разворачиваем
};


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
    /** Логическое значение (`boolean`) */
    Boolean,
    /** Строка (`string`) */
    String,
    /** Число (`number`) */
    Number,
    /** Множество уникальных строк (`Set<string>`) */
    StringSet
}


declare namespace Configuration {


    /** Отображает интерфейс конфигурации в схему дескрипторов полей.
     *
     * Каждый лист `T[K]` должен быть одним из {@link OptionType | известных типов}.
     *
     * Каждое свойство `T[K]` примитивного типа заменяется на соответствующий
     * `*Option`-дескриптор; вложенные объекты обходятся рекурсивно.
     *
     * Используй с оператором `satisfies`, чтобы TypeScript проверил,
     * что схема действительно описывает целевой интерфейс.
     *
     * @template T Интерфейс, описывающий итоговую типизированную конфигурацию.
     *
     * @example
     * ```ts
     * interface ICfg {
     *     node: { useIcon: boolean; label: string };
     * }
     *
     * const schema = {
     *     node: {
     *         useIcon: { path: 'myExt.node', type: OptionType.Boolean, spec: { fallback: false } },
     *         label:   { path: 'myExt.node', type: OptionType.String,  spec: { fallback: 'Task' } },
     *     }
     * } satisfies Configuration.ConfigSchema<ICfg>;
     * ``` */
    export type ConfigSchema<T> = {
        [K in keyof T]: FieldDefFor<T[K]> extends never
        ? ConfigSchema<T[K]>           // объект — идём глубже
        : FieldDefFor<T[K]>;  // примитив — оборачиваем
    };

}



// минимальная валидация-типизация конфигурации
const Configuration = {

    COCKPIT_SECTION_NAME: 'taskCockpit' satisfies TC.ConfigSectionName,

    /** Читает и валидирует конфигурацию, полученную от VS Code по типизированной схеме.
     *
     * Используется для получения и *базовой* валидации, позволяя избежать
     * проблем с отсутствием или сломанными настройками.
     *
     * Рекурсивно обходит переданную схему, для каждого дескриптора в схеме:
     * извлекает сырое значение через `workspaceConfig.get(<path>.<key>)` и приводит его
     * к ожидаемому типу, применяя правила, описанные в дескрипторе.
     *
     * Отсутствующие или невалидные значения заменяются на `fallback` поля.
     * Числовые значения обрезаются до `[min, max]`, если границы заданы.
     * Строки проверяются на соответствие паттерну.
     *
     * **Безопасность:** метод никогда не выбрасывает исключений; все некорректные
     * или отсутствующие значения заменяются на `fallback`.
     *
     * @template S Тип схемы.
     * @param {S} schema Объект, {@linkcode Configuration.ConfigSchema | описывающий структуру и правила валидации},
     *   для проверки формы на этапе компиляции.
     * @param workspaceConfig Экземпляр `vscode.WorkspaceConfiguration`.
     * @returns Объект, зеркально повторяющий структуру схемы, с валидными значениями,
     *   приведёнными к соответствующим типам.
     *
     * @example
     * ```ts
     * interface ICfg {
     *     node: {
     *         readonly 'useIcon': boolean,
     *         readonly 'iconName': string,
     *         readonly 'showMax': number,
     *     };
     *     tree: {
     *         readonly 'show': boolean,
     *     };
     * }
     *
     * const schema = {
     *     node: {
     *         useIcon: { path: 'cfg.node', type: OptionType.Boolean, spec: { fallback: false } },
     *         iconName: { path: 'cfg.node', type: OptionType.String, spec: { fallback: '', pattern: /.*\\.png/ } },
     *         showMax: { path: 'cfg.display', type: OptionType.Number, spec: { fallback: 15, max: 30 } }
     *     },
     *     tree: {
     *         show: { path: 'cfg.showTree', type: OptionType.Boolean, spec: { fallback: true } }
     *     }
     * } satisfies Configuration.ConfigSchema<ICfg>;
     *
     * const cfgResult = Configuration.get(schema, {} as any);
     * // TS say:
     * // const cfgResult: {
     * //     node: {
     * //         useIcon: boolean;
     * //         iconName: string;
     * //         showMax: number;
     * //     };
     * //     tree: {
     * //         show: boolean;
     * //     };
     * // }
     * ``` */
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


// проверка спеки валидатором
function resolveFieldValue(configKey: string, fieldDef: Readonly<AnyConfigOption>, workspaceConfig: vscode.WorkspaceConfiguration) {

    const input = workspaceConfig.get(`${fieldDef.path}.${configKey}`);

    switch (fieldDef.type) {

        case OptionType.Boolean: {
            return coerceBoolean(input, fieldDef);
        }
        case OptionType.Number: {
            return coerceNumber(input, fieldDef);
        }
        case OptionType.String: {
            return coerceString(input, fieldDef);
        }
        case OptionType.StringSet: {
            return coerceStringSet(input, fieldDef);
        }

        default:
            const _spec: never = fieldDef;
            throw _spec;
    };
}


function isFieldDef(value: unknown): value is AnyConfigOption {
    return (
        typeof value === 'object' &&
        value !== null &&
        'path' in value &&
        'type' in value &&
        'spec' in value
    );
}


// -----
// #region Валидаторы

function coerceNumber(value: unknown, fieldDef: NumberOption): number {

    const { spec } = fieldDef;

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


function coerceBoolean(value: unknown, fieldDef: BooleanOption): boolean {

    const { spec } = fieldDef;

    return typeof value === 'boolean' ? value : spec.fallback;
}


function coerceString(value: unknown, fieldDef: StringOption): string {

    const { spec } = fieldDef;
    if (typeof value !== 'string') return spec.fallback;
    if (spec.pattern != null && !spec.pattern.test(value)) return spec.fallback;

    return value;
}


function coerceStringSet(value: unknown, fieldDef: StringSetOption): Set<string> {

    const { spec } = fieldDef;
    if (!Array.isArray(value)) return new Set(spec.fallback);

    // если пришёл массив, но все элементы не-строки, вернём [], а не fallback.
    // пустой массив — валидное значение, семантически отличное от "конфиг сломан".
    return new Set(value.filter((item): item is string => typeof item === 'string'));
}

// #endregion Валидаторы


export default Configuration;
export { OptionType };
