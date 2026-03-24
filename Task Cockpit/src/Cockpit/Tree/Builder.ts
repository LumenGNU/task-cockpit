/** @file Cockpit/Tree/Builder.ts */
/** @module Builder */

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG



/** Спецификация ветки: путь (сегменты) + данные на конце. */
type SpecType<D extends object> = Readonly<{
    segments: readonly string[];
    data: D;
}>;

// есть три случая:
// 
// тип 1, два свойства:
// узел с данными, без детей,
// узел с данными, с детьми,
// 
// тип2
// узел без данных, с детьми.
// 
// узел без данных, без детей -- не существует
/** Узел дерева. */
type NodeType<D extends object>
    = {
        /** Дочерние узлы есть. */
        // children: NodeType<D>[];
        // parent: Node<D> | undefined;
    }
    | DataNode<D>;

/** Узел дерева с данными. */
export type DataNode<D extends object>
    = {
        /** Дочерние узлы (если есть). */
        // children?: NodeType<D>[];
        // parent: Node<D> | undefined;
    } & D;

// ---

const DATA_KEY: unique symbol = Symbol('data');
const SEGMENT_KEY: unique symbol = Symbol('segment');
const CHIDREN_DICT: unique symbol = Symbol('children');
const PARENT_KEY: unique symbol = Symbol('parent');


type Dict<D extends object> = { [segment: string]: SymbolsNode<D> | undefined };


type SymbolsNode<D extends object> = {
    [DATA_KEY]?: true;
    /** Имя узла (его часть пути). */
    [SEGMENT_KEY]: string;
    [PARENT_KEY]: SymbolsNode<D> | undefined;
    [CHIDREN_DICT]?: Dict<D>;
} & NodeType<D>



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
 * ## Builder — "тупой" и быстрый
 *
 * {@linkcode Builder.build} должен быть быстрый построитель.
 * Проверка 500 сегментов по 500 символов на символ, крайне маловероятный
 * в "правильном" вводе — ненужное замедление. Поэтому:
 *
 * @warning
 * Алгоритм в prod-сборке не защищен от SEPARATOR в scopeId!
 *
 * @warning
 * Алгоритм в prod-сборке не защищен от сегментов, содержащие SEPARATOR!
 * */
const Builder = {

    // /** Разделитель для формирования nodeId. */
    // // U+001F is the Unit Separator
    // SEPARATOR: '\x1F' as const,

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
    build: function <D extends object, S extends string>(scopeId: S, specs: readonly SpecType<Readonly<D>>[]): NodeType<D>[] {

        // #region DEBUG
        assert(scopeId, 'The "scope" should not be falsy');
        // assert(scopeId.includes(this.SEPARATOR) === false, 'The "scope" should not contain SEPARATOR');
        // #endregion DEBUG

        // // Корень — часть **внутренней реализации**, не выдается наружу.
        // //
        // // Нужен только как "затравка" {@link nodeMap | в карте}.
        // //
        // // `rootPath` — это специальный внутренний узел, который использует ту же карту
        // // что и "настоящие" узлы, но не является `NodePath`. Это противоречие реализации.
        // // Я не нашел "красивого" и простого решения: либо каст просто переедет в
        // // другое место. Либо усложняется логика поиска родителя.
        // //
        // // В любом случае: это деталь реализации, которая не видна наружу.
        // const rootPath = `${scopeId}${this.SEPARATOR}` satisfies NodePath<S>;

        // // Карта для поиска node по полному пути на ветке
        // // **Внутренняя структура**, используется при построении дерева.
        // const nodeMap = new Map<NodePath<S>, Node<D>>([
        //     [rootPath, { _segment: scopeId, children: [], nodePath: rootPath }]
        // ]);


        // root dict: segment -> node (preserve insertion order via roots array)
        const rootDict: Dict<D> = Object.create(null);


        const rootNode = Object.create(null) as SymbolsNode<D>;
        rootNode[SEGMENT_KEY] = scopeId;
        rootNode[PARENT_KEY] = undefined;
        rootNode.children = [];


        // helper to create a node for a given parentPath and segment
        const createSeed = function (parent: SymbolsNode<D>, segment: string): SymbolsNode<D> {
            const seed: SymbolsNode<D> = Object.create(null);
            seed[SEGMENT_KEY] = segment;
            seed[PARENT_KEY] = parent;
            return seed;
        };


        // Обрабатываем массив спецификаций
        for (const { segments, data } of specs) {

            const firstSegment = segments.at(0);

            if (firstSegment === undefined) {
                // #region DEBUG
                log(LogLevel.Trace, 'The number of “segments” is less than one');
                // #endregion DEBUG
                continue;
            }

            let fistNode = rootDict[firstSegment];
            if (!fistNode) {
                fistNode = createSeed(rootNode, firstSegment);
                rootDict[firstSegment] = fistNode;
                rootNode.children.push(fistNode);
            }

            let current = fistNode;
            // traverse remaining segments
            for (const segment of segments.slice(1)) {

                // ensure children dict exists
                const dict: Dict<D> = current[CHIDREN_DICT] ??= Object.create(null);
                current[CHIDREN_DICT] = dict;


                // lazily create children array on parent
                let childNode = dict[segment];
                if (!childNode) {
                    childNode = createSeed(current, segment);
                    dict[segment] = childNode;
                    // @fixme !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                    (current.children ??= []).push(childNode);
                }

                current = childNode;
            }

            // parent is the endpoint node for this spec; spread data onto it
            // #region DEBUG
            if (DATA_KEY in current) {
                log(LogLevel.Warning, `Duplicate path in scope "${scopeId}": "?????????". Data overwritten`);
            }
            // #endregion DEBUG
            Object.assign(current, { [DATA_KEY]: true, ...data });


            // segments.reduce<number>((remaining, segment) => {

            //     // #region DEBUG
            //     // assert(segment.length > 0, 'The count of "segment" is at least one char');
            //     // assert(segment.includes(this.SEPARATOR) === false, 'The "segment" should not contain SEPARATOR');
            //     // #endregion DEBUG

            //     // // Замена пустого сегмента
            //     // _segment ||= this.Node.C0_SUB;

            //     // const nodePath = `${path}${this.SEPARATOR}${segment}` satisfies NodePath<S>;

            //     let node = nodeMap.get(nodePath);

            //     if (!node) {
            //         // @fixme: нужен промежуточный тип? @decision: каст допустим —
            //         // объект доконструируется в рамках текущей итерации/прохода,
            //         // наружу из build() неполные узлы не выходят.
            //         node = { _segment: segment, nodePath } as Node<D>;
            //         nodeMap.set(nodePath, node);
            //         (nodeMap.get(path)!.children ??= []).push(node);
            //     }

            //     // Последний сегмент — записываем в него данные.
            //     // Теперь он — "лист": Содержит данные и маркер.
            //     if (remaining === 0) {
            //         // #region DEBUG
            //         if (DATA_KEY in node) {
            //             log(LogLevel.Warning, `Duplicate path in scope "${scopeId}": "${nodePath}". Data overwritten`);
            //         }
            //         // #endregion DEBUG
            //         Object.assign(node, { [DATA_KEY]: true, ...data });
            //     }

            //     return remaining - 1;
            // },
            //     segments.length - 1);
        }

        return rootNode.children;
    },

    /** Разобрать {@linkcode Builder.NodePath nodePath} узла на составляющие: scope и сегменты.
     *
     * @template D тип данных data-узлов
     * @template S строковый идентификатор scope
     *
     * @param node узел дерева, построенного через {@linkcode Builder.build}
     * @returns объект, состоящий из scope и массива сегментов */
    parsePath: function <D extends object, S extends string>(node: NodeType<D>): { scopeId: S, segments: string[]; } {
        const parts: string[] = [];
        let current = node as SymbolsNode<D> | undefined;

        while (current) {
            parts.push(current[SEGMENT_KEY]);
            current = current[PARENT_KEY];
        }

        parts.reverse(); // от корня к листу

        const [scopeId, ...segments] = parts;
        return { scopeId: scopeId as S, segments };
    },

    Node: {

        // C0_SUB: '\x1a' as const,

        /** Имеет ли узел детей. Это проверка на свойство, НЕ тип.
         *
         * Дети добавляются через ??=, так что у чистых листьев ключа children нет вообще.
         * А у нод с детьми (с полем `children`) не может быть 0 детей.
         *
         * "Чистый лист" = `!isBranch` — это всегда `DataNode`, но `DataNode` — не всегда "чистый лист"  */
        isBranch: function (node: NodeType<any>): boolean {
            return CHIDREN_DICT in node;
        },

        /** Type guard: Содержит ли узел данные.
         *
         * (соответствует ли спецификации из {@linkcode build}).
         *
         * Это сужение не мешает узлу иметь свойство {@linkcode NodeType.isBranch}, и находится в любой точке дерева. */
        isData: function <D extends object>(node: NodeType<D>): node is DataNode<D> {
            return DATA_KEY in node;
        },


        decodeSegment: function (node: NodeType<any>): string {
            return node[SEGMENT_KEY];
            // return (node._segment === this.C0_SUB) ? '' : node._segment;
        },

    } as const,
} as const;


namespace Builder {
    /** Спецификация ветки: путь (сегменты) + данные на конце. */
    export type Spec<D extends object> = SpecType<D>;
    /** Узел дерева. */
    export type Node<D extends object> = NodeType<D>;
}


export default Builder;
