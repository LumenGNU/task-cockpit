/** @file TreeModel/Splitter.ts */
/** @module Splitter */


/** Разбивает строку на сегменты согласно правилам разделителя.
 *
 * Правила разбиения:
 * 1. Разделитель срабатывает только между «значимыми» символами
 * 1. «Значимый» символ — не пробел и не сам разделитель
 *
 * @param segmentsSpec строка для разбиения
 * @returns массив сегментов; если разбиение невозможно или отключено —
 *          массив из одного элемента (исходная строка) */
export type SplitFunc = (segmentsSpec: string) => string[];

/** Разбиение строки на сегменты по заданному разделителю с учётом контекста.
 *
 * Разделитель срабатывает только между «значимыми» символами — не пробелами
 * и не самим разделителем. Это предотвращает разбиение на границах строки
 * и при повторяющихся разделителях.
 *
 * Пробельные символы не могут быть разделителем.
 *
 * Примеры поведения (delimiter = '/'):
 * ~~~typescript
 * const splitter = new Splitter('/');
 * splitter.split('a/b/c');        // [ 'a', 'b', 'c' ]
 * splitter.split('a / b');        // [ 'a / b' ]      (пробелы рядом с /)
 * splitter.split('/a/b/');        // [ '/a', 'b/' ]   (/ в начале и конце сохраняются)
 * splitter.split('a//b');         // [ 'a//b' ]       (двойной //)
 *
 * const noSplit = new Splitter(false);
 * noSplit.split('a/b/c');         // [ 'a/b/c' ]      (разбиение отключено)
 * ~~~
 *
 * ### API
 *
 * #### Параметры конструктора:
 * - `delimiter` Символ-разделитель, пустая строка или `false` для отключения разбиения
 *
 * #### Методы:
 * - `split()` Разбивает строку на сегменты согласно правилам разделителя
 *
 * */
interface Splitter {
    readonly split: SplitFunc;
};

const Splitter = {

    /** Создаёт функцию разбиения строк по заданному разделителю.
     *
     * Если разделитель невалиден или отключён, возвращает функцию,
     * которая всегда возвращает массив из одного элемента.
     *
     * @param delimiter символ-разделитель или `false`|`''` для отключения разбиения */
    create(delimiter: string | false): Splitter {
        /** RegExp для разбиения строки на сегменты.
         *
         * Использует позитивные lookahead и lookbehind для проверки контекста:
         * - Перед разделителем должен быть "значимый" символ (не пробел, не разделитель)
         * - После разделителя должен быть "значимый" символ (не пробел, не разделитель)
         *
         * `undefined` если разбиение отключено или разделитель невалиден. */
        const splitRegex = buildSplitRegex(delimiter);
        return splitRegex
            ? { split: function (s: string) { return s.split(splitRegex); } } as const
            : { split: function (s: string) { return [s]; } } as const;
    }

} as const;


function buildSplitRegex(delimiter: string | false): RegExp | undefined {
    if (!delimiter) {
        return undefined;
    }
    const sanitized = delimiter[0]?.trimStart().replace(/[.*+?^${}()|[\]\\]/, '\\$&');
    if (!sanitized) {
        return undefined;
    }
    return new RegExp(`(?<=[^${sanitized}\\s])${sanitized}(?=[^${sanitized}\\s])`);
}


export default Splitter;
