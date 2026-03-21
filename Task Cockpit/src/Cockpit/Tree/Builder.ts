/** @file Cockpit/Tree/Builder.ts */
/** @module Builder */

import type { Builder } from '../../types';

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


const DATA_MARKER: unique symbol = Symbol('data');


/** Разделитель для формирования nodeId.
 * NUL-символ исключает коллизии с именами сегментов. */
const SEPARATOR: Builder.Separator = '\0' as const;


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
 * */
const Builder = {

    /**  Построить дерево из списка {@linkcode Builder.SpecType | спецификаций}.
     *
     * Алгоритм: для каждой спецификации проходим по сегментам,
     * создавая узлы по мере необходимости (или повторно используя существующие).
     * Данные записываются в последний сегмент пути.
     *
     * @template D тип данных, записываемых в data-узлы. Не должен пересекаться с {@linkcode ProhibitedKeys}.
     * @template S строковый scope — используется как префикс {@linkcode Builder.NodePath}
     *
     * @param scope уникальный идентификатор корня (используется как префикс nodeId)
     * @param specs массив {@link Builder.SpecType | спецификаций} (путь + данные)
     * @returns корневые узлы построенного дерева */
    build: function <D extends object, S extends string>(scope: S, specs: readonly Builder.SpecType<D>[]): Builder.Node<D, S>[] {

        // #region DEBUG
        assert(scope, 'The "scope" should not be falsy');
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
        const rootPath = scope as Builder.NodePath<S>; // без trailing \0 (без SEPARATOR)

        // Карта для поиска node по полному пути на ветке
        // **Внутренняя структура**, используется при построении дерева.
        const nodeMap = new Map<Builder.NodePath<S>, Builder.Node<D, S>>([
            [rootPath, { segment: scope, children: [], nodePath: rootPath }]
        ]);

        // Обрабатываем массив спецификаций
        for (const { segments, data } of specs) {

            // #region DEBUG
            assert(segments.length > 0, 'The count of "segments" is at least one');
            // #endregion DEBUG

            segments.reduce<{ path: Builder.NodePath<S>; remaining: number; }>(
                ({ path, remaining }, segment) => {

                    // #region DEBUG
                    assert(segment.length > 0, 'The count of "segment" is at least one char');
                    // #endregion DEBUG

                    const nodePath = `${path}${SEPARATOR}${segment}` satisfies Builder.NodePath<S>;
                    let node = nodeMap.get(nodePath);

                    if (!node) {
                        // @fixme: нужен промежуточный тип? @decision: каст допустим —
                        // объект доконструируется в рамках текущей итерации/прохода,
                        // наружу из build() неполные узлы не выходят.
                        node = { segment, nodePath } as Builder.Node<D, S>;
                        nodeMap.set(nodePath, node);
                        (nodeMap.get(path)!.children ??= []).push(node);
                    }

                    // Последний сегмент — записываем в него данные.
                    // Теперь он — "лист": Содержит данные и маркер.
                    if (remaining === 0) {
                        // #region DEBUG
                        if (DATA_MARKER in node) {
                            log(LogLevel.Warning, `Duplicate path in scope "${scope}": "${nodePath}". Data overwritten`);
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
     * @template S строковый scope
     * @param node узел дерева, построенного через {@linkcode Builder.build}
     * @returns кортеж `[scope, ...segments]` — минимум два элемента (scope + хотя бы один сегмент)
     * @throws {AssertionError} (только в debug-сборке) если `nodePath` содержит менее двух компонентов (вызов на корневом узле) */
    parsePath: function <D extends object, S extends string>(node: Builder.Node<D, S>): [S, ...string[]] {

        // #region DEBUG
        const p = node.nodePath.split(SEPARATOR);
        assert(p.length >= 2, 'parsePath called on root node — expected at least scope + segment');
        // #endregion DEBUG

        return node.nodePath.split(SEPARATOR) as [S, ...string[]];
    },

    Node: {

        /** Имеет ли узел детей. Это проверка на свойство, НЕ тип.
         *
         * Дети добавляются через ??=, так что у чистых листьев ключа children нет вообще.
         * А у нод с детьми (с полем `children`) не может быть 0 детей.
         *
         * "Чистый лист" = `!isBranch` — это всегда `DataNode`, но `DataNode` — не всегда "чистый лист"  */
        isBranch: function <D extends object, S extends string>(node: Builder.Node<D, S>): boolean {
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
    }
} as const;


export default Builder;
