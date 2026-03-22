/** @file Cockpit/Tree/Builder.ts */
/** @module Builder */

import type { Builder } from '../../types';

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


const DATA_MARKER: unique symbol = Symbol('data');


/** Модуль построения дерева из плоских путей.
 *
 * Принимает массив {@link Builder.SpecType | "спецификаций"} — путей вида `['a', 'b', 'c']` с данными —
 * и строит из них дерево с общими префиксами.
 *
 * Порядок спецификаций не влияет на структуру дерева:
 * `[a,b,c], [a,b]` и `[a,b], [a,b,c]` дадут идентичный результат.
 *
 * Дубликаты путей создают коллизию —
 * данные перезаписываются с предупреждением в лог.
 *
 * Спецификации с пустым массивом сегментов (`segments: []`) молча игнорируются —
 * не создают узлов и не влияют на остальное дерево.
 *
 * @example
 * // Вход:
 * [
 *   { segments: ['build', 'dev'],  data: task1 },
 *   { segments: ['build', 'prod'], data: task2 },
 *   { segments: ['test'],          data: task3 }
 * ]
 * // Выход (дерево):
 * // ├─ build
 * // │  ├─ dev  [task1]
 * // │  └─ prod [task2]
 * // └─ test [task3]
 *
 * @example
 * // Узел может быть одновременно промежуточным и содержать данные:
 * [
 *   { segments: ['build'],        data: taskAll },
 *   { segments: ['build', 'dev'], data: taskDev }
 * ]
 * // Выход:
 * // └─ build [taskAll]
 * //    └─ dev [taskDev]
 *
 * ## Builder — это "тупой" и быстрый
 *
 * {@linkcode Builder.build} должен быть быстрый построитель.
 * Проверка 500 сегментов по 500 символов на символ, крайне маловероятный
 * в "правильном" вводе — ненужное замедление. Поэтому:
 *
 *
 * @warning
 * Алгоритм в prod-сборке не защищен от SEPARATOR в scopeId!
 *
 * @warning
 * Алгоритм в prod-сборке не защищен от сегментов, состоящих из пустых строк!
 *
 * @warning
 * Алгоритм в prod-сборке не защищен от сегментов, содержащие SEPARATOR!
 * */
const Builder = {

    /** Разделитель для формирования nodeId. */
    // U+001F is the Unit Separator
    SEPARATOR: '\x1F' as const,

    /**  Построить дерево из списка {@linkcode Builder.SpecType | спецификаций}.
     *
     * Алгоритм: для каждой спецификации проходим по сегментам,
     * создавая узлы по мере необходимости (или повторно используя существующие).
     * Данные записываются в последний сегмент пути.
     *
     * @template D тип данных, записываемых в data-узлы. Не должен пересекаться с {@linkcode ProhibitedKeys}.
     * @template S строковый scope — используется как префикс {@linkcode Builder.NodePath}
     *
     * @param scopeId идентификатор ветки — первый элемент {@linkcode Builder.Node.nodePath | nodePath} всех узлов в ней
     * @param specs массив {@link Builder.SpecType | спецификаций} (путь + данные)
     * @returns корневые узлы построенного дерева */
    build: function <D extends object, S extends string>(scopeId: S, specs: readonly Builder.SpecType<Readonly<D>>[]): Builder.Node<D, S>[] {

        // #region DEBUG
        assert(scopeId, 'The "scope" should not be falsy');
        assert(scopeId.includes(this.SEPARATOR) === false, 'The "scope" should not contain SEPARATOR');
        // #endregion DEBUG

        // Корень — часть **внутренней реализации**, не выдается наружу.
        //
        // Нужен только как "затравка" {@link nodeMap | в карте}.
        //
        // `rootPath` — это специальный внутренний узел, который использует ту же карту
        // что и "настоящие" узлы, но не является `NodePath`. Это противоречие реализации.
        // Я не нашел "красивого" и простого решения: либо каст просто переедет в
        // другое место. Либо усложняется логика поиска родителя.
        //
        // В любом случае: это деталь реализации, которая не видна наружу.
        const rootPath = `${scopeId}${this.SEPARATOR}` satisfies Builder.NodePath<S>;

        // Карта для поиска node по полному пути на ветке
        // **Внутренняя структура**, используется при построении дерева.
        const nodeMap = new Map<Builder.NodePath<S>, Builder.Node<D, S>>([
            [rootPath, { _segment: scopeId, children: [], nodePath: rootPath }]
        ]);

        // Обрабатываем массив спецификаций
        for (const { segments, data } of specs) {

            // #region DEBUG
            assert(segments.length > 0, 'The count of "segments" is at least one');
            // #endregion DEBUG

            segments.reduce<{ path: Builder.NodePath<S>; remaining: number; }>(
                ({ path, remaining }, _segment) => {

                    // #region DEBUG
                    assert(_segment.length > 0, 'The count of "segment" is at least one char');
                    assert(_segment.includes(this.SEPARATOR) === false, 'The "segment" should not contain SEPARATOR');
                    // #endregion DEBUG

                    // Замена пустого сегмента
                    _segment ||= this.Node.C0_SUB;

                    const nodePath = `${path}${this.SEPARATOR}${_segment}` satisfies Builder.NodePath<S>;
                    let node = nodeMap.get(nodePath);

                    if (!node) {
                        // @fixme: нужен промежуточный тип? @decision: каст допустим —
                        // объект доконструируется в рамках текущей итерации/прохода,
                        // наружу из build() неполные узлы не выходят.
                        node = { _segment, nodePath } as Builder.Node<D, S>;
                        nodeMap.set(nodePath, node);
                        (nodeMap.get(path)!.children ??= []).push(node);
                    }

                    // Последний сегмент — записываем в него данные.
                    // Теперь он — "лист": Содержит данные и маркер.
                    if (remaining === 0) {
                        // #region DEBUG
                        if (DATA_MARKER in node) {
                            log(LogLevel.Warning, `Duplicate path in scope "${scopeId}": "${nodePath}". Data overwritten`);
                        }
                        // #endregion DEBUG
                        Object.assign(node, { [DATA_MARKER]: true, ...data });
                    }

                    return { path: nodePath, remaining: remaining - 1 };
                },
                { path: rootPath, remaining: segments.length - 1 }
            );
        }

        return nodeMap.get(rootPath)!.children!;
    },

    /** Разобрать {@linkcode Builder.NodePath nodePath} узла на составляющие: scope и сегменты.
     *
     * @template D тип данных data-узлов
     * @template S строковый идентификатор scope
     *
     * @param node узел дерева, построенного через {@linkcode Builder.build}
     * @returns объект, состоящий из scope и массива сегментов
     * @throws {AssertionError} (только в debug-сборке) если `nodePath` содержит меньше|больше двух компонентов (S+[segments]) */
    parsePath: function <D extends object, S extends string>(node: Builder.Node<D, S>): { scopeId: S, segments: string[]; } {

        // #region DEBUG
        const p = node.nodePath.split(`${this.SEPARATOR}${this.SEPARATOR}`);
        assert(p.length === 2, 'parsePath called on root node — expected at least scope + segment or BUG');
        // #endregion DEBUG

        const [scopeId, segments] = node.nodePath.split(`${this.SEPARATOR}${this.SEPARATOR}`) as [S, string];

        return {
            scopeId,
            segments: segments.split(this.SEPARATOR)
                .map( // востановление пустого сегмента
                    (s) => (s === this.Node.C0_SUB) ? '' : s
                )
        };
    },

    Node: {

        C0_SUB: '\x1a' as const,

        /** Имеет ли узел детей. Это проверка на свойство, НЕ тип.
         *
         * Дети добавляются через ??=, так что у чистых листьев ключа children нет вообще.
         * А у нод с детьми (с полем `children`) не может быть 0 детей.
         *
         * "Чистый лист" = `!isBranch` — это всегда `DataNode`, но `DataNode` — не всегда "чистый лист"  */
        isBranch: function (node: Builder.Node<any, any>): boolean {
            return 'children' in node;
        },

        /** Type guard: Содержит ли узел данные.
         *
         * (соответствует ли спецификации из {@linkcode Builder.build}).
         *
         * Это сужение не мешает узлу иметь свойство {@linkcode Builder.Node.isBranch}, и находится в любой точке дерева. */
        isData: function <D extends object, S extends string>(node: Builder.Node<D, S>): node is Builder.DataNode<D, S> {
            return DATA_MARKER in node;
        },


        decodeSegment: function (node: Builder.Node<any, any>): string {
            return (node._segment === this.C0_SUB) ? '' : node._segment;
        },

    }
} as const;


export type { Builder } from '../../types';
export default Builder;
