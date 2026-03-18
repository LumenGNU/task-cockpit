/** @file Cockpit/Tree/Builder.ts */
/** @module Builder */


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


type NodePath<S extends string = string> = `${S}${typeof SEPARATOR}${string}`;


/** Спецификация ветки: путь (сегменты) + данные на конце. */
type SpecType<I extends string> = Readonly<{ segments: readonly string[], id: I; }>;


/** Узел дерева. */
type NodeType<I extends string, S extends string> = {
    /** Имя узла (его часть пути). */
    segment: string;
    /** Дочерние узлы (если есть). */
    children?: NodeType<I, S>[];
    /** Данные (только у "листьев" — узлов-с-данными). */
    id?: I;
    /** Уникальный идентификатор узла (не задачи) в пределах дерева.
     * Формируется из полного пути, включая segment: `scope\0seg1\0seg2\segment`. */
    nodePath: NodePath<S>;
};


// // @todo это не тип, а свойство
// /** Узел с гарантированно присутствующими данными — "листом". */
// type DataNodeType<T, S extends string = string> = Omit<NodeType<T, S>, 'data'> & { data: T; };


/** Разделитель для формирования nodeId.
 * NUL-символ исключает коллизии с именами сегментов. */
const SEPARATOR = '\0' as const;


/**  Построить дерево из списка спецификаций.
 *
 * Алгоритм: для каждой спецификации проходим по сегментам,
 * создавая узлы по мере необходимости (или повторно используя существующие).
 * Данные записываются в последний сегмент пути.
 *
 * @param scope уникальный идентификатор корня (используется как префикс nodeId)
 * @param specs массив спецификаций (путь + данные)
 * @returns корневые узлы построенного дерева */
function build<I extends string, S extends string>(scope: S, specs: readonly SpecType<I>[]): NodeType<I, S>[] {

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
    const rootPath = scope as NodePath<S>; // без trailing \0 (без SEPARATOR)

    // Карта для поиска node по полному пути на ветке
    // **Внутренняя структура**, используется при построении дерева.
    const nodeMap = new Map<string, NodeType<I, S>>([
        [rootPath, { segment: scope, children: [], nodePath: rootPath }]
    ]);

    // Обрабатываем массив спецификаций
    for (const { segments, id } of specs) {

        // #region DEBUG
        assert(segments.length > 0, 'The count of "segments" is at least one');
        // #endregion DEBUG

        segments.reduce<{ path: NodePath<S>; remaining: number; }>(
            ({ path, remaining }, segment) => {

                // #region DEBUG
                assert(segment.length > 0, 'The count of "segment" is at least one char');
                // #endregion DEBUG

                const nodePath = concatNodePath(path, segment);
                let node = nodeMap.get(nodePath);

                if (!node) {
                    node = { segment, nodePath };
                    nodeMap.set(nodePath, node);
                    (nodeMap.get(path)!.children ??= []).push(node);
                }

                // Последний сегмент — записываем в него данные.
                // Теперь он — "лист"
                if (remaining === 0) {
                    // #region DEBUG
                    if (node.id) {
                        log(LogLevel.Warning,
                            `Path "${segments.join(' → ')}" collision at "${segment}" will be overwritten`);
                    }
                    // #endregion DEBUG

                    node.id = id;
                }

                return { path: nodePath, remaining: remaining - 1 };
            },
            { path: rootPath, remaining: segments.length - 1 }
        );
    }

    return nodeMap.get(rootPath)!.children!;
}


/** Узел указывает на данные.
 *
 * Это не "тип", а "свойство". */
function isDataNode<I extends string, S extends string>(node: NodeType<I, S>): boolean {
    return node.id !== undefined;
}


/** Проверка возможности наличия дочерних узлов в принципе.
 *
 * Это не "тип", а "свойство".
 *
 * Дети добавляются через ??=, так что у чистых листьев ключа children нет вообще.
 * А у нод с детьми (с полем `children`) не может быть 0 детей. */
function isBranch<I extends string, S extends string>(node: NodeType<I, S>): boolean {
    return 'children' in node;
}


function parsePath<I extends string, S extends string>(node: NodeType<I, S>): [S, ...string[]] {

    // #region DEBUG
    const p = node.nodePath.split(SEPARATOR);
    assert(p.length >= 2, 'parsePath called on root node — expected at least scope + segment');
    // #endregion DEBUG

    return node.nodePath.split(SEPARATOR) as [S, ...string[]];
}


function concatNodePath<S extends string>(path: NodePath<S>, segment: string): NodePath<S> {
    return `${path}${SEPARATOR}${segment}`;
}


/**
 * Модуль построения дерева из плоских путей.
 *
 * Принимает массив "спецификаций" — путей вида `['a', 'b', 'c']` с данными —
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
    build,
    parsePath,
    Node: {
        isDataNode,
        isBranch,
    }
} as const;

namespace Builder {
    export type Spec<I extends string> = SpecType<I>;
    export type Node<I extends string, S extends string> = NodeType<I, S>;
}

export default Builder;
