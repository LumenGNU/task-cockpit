/** @file Cockpit/Tree/Builder.ts */
/** @module Builder */


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


type NodePath<S extends string = string> = `${S}${typeof SEPARATOR}${string}`;


/** Спецификация ветки: путь (сегменты) + данные на конце. */
type SpecType<D extends object> = Readonly<{ segments: readonly string[], data: D; }>;


/** Узел дерева. */
type InternodeNodeType<D extends object, S extends string> = {
    /** Имя узла (его часть пути). */
    segment: string;
    /** Дочерние узлы (если есть). */
    children: (InternodeNodeType<D, S> | DataNodeType<D, S>)[];

    /** Уникальный идентификатор узла (не задачи) в пределах дерева.
     * Формируется из полного пути, включая segment: `scope\0seg1\0seg2\segment`. */
    nodePath: NodePath<S>;
};

type DataNodeType<D extends object, S extends string> = {
    /** Имя узла (его часть пути). */
    segment: string;
    /** Дочерние узлы (если есть). */
    children?: (InternodeNodeType<D, S> | DataNodeType<D, S>)[];

    /** Уникальный идентификатор узла (не задачи) в пределах дерева.
     * Формируется из полного пути, включая segment: `scope\0seg1\0seg2\segment`. */
    nodePath: NodePath<S>;
} & Omit<D, 'children' | 'segment' | 'nodePath'>;


type NodeType<D extends object, S extends string> = InternodeNodeType<D, S> | DataNodeType<D, S>;


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
function build<D extends object, S extends string>(scope: S, specs: readonly SpecType<D>[]): NodeType<D, S>[] {

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
    const nodeMap = new Map<string, NodeType<D, S>>([
        [rootPath, { segment: scope, children: [], nodePath: rootPath }]
    ]);

    // Обрабатываем массив спецификаций
    for (const { segments, data } of specs) {

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
                    // @fixme: нужен промежуточный тип? @decision: каст допустим —
                    // объект доконструируется в рамках текущей итерации/прохода,
                    // наружу из build() неполные узлы не выходят.
                    node = { segment, nodePath } as NodeType<D, S>;
                    nodeMap.set(nodePath, node);
                    (nodeMap.get(path)!.children ??= []).push(node);
                }

                // Последний сегмент — записываем в него данные.
                // Теперь он — "лист"
                if (remaining === 0) {
                    Object.assign(node, data);
                }

                return { path: nodePath, remaining: remaining - 1 };
            },
            { path: rootPath, remaining: segments.length - 1 }
        );
    }

    return nodeMap.get(rootPath)!.children!;
}




/**
 *
 * Дети добавляются через ??=, так что у чистых листьев ключа children нет вообще.
 * А у нод с детьми (с полем `children`) не может быть 0 детей. */
function isBranch<D extends object, S extends string>(node: NodeType<D, S>): node is InternodeNodeType<D, S> {
    return 'children' in node;
}


function parsePath<D extends object, S extends string>(node: NodeType<D, S>): [S, ...string[]] {

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
    // concatNodePath,
    parsePath,
    Node: {
        isBranch,
    }
} as const;

namespace Builder {
    export type Spec<D extends object> = SpecType<D>;
    export type InternodeNode<D extends object, S extends string> = InternodeNodeType<D, S>;
    export type DataNode<D extends object, S extends string> = DataNodeType<D, S>;
}

export default Builder;
