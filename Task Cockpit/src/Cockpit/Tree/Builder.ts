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


/** Узел иерархии.
 *
 * Три варианта:
 * - данные, без детей (лист)
 * - данные и дети (промежуточный с данными)
 * - только дети, без данных (чисто группирующий)
 *
 * Узел без данных и без детей не существует.
 *
 * @see {@linkcode Builder.Node.isData} — проверка наличия данных
 * @see {@linkcode Builder.Node.isBranch} — проверка наличия детей */
type NodeType<D extends object, S extends string> = SymbolsNode<D, S> | (SymbolsNode<D, S> & D);

// ---

/** Флаг: узел содержит данные из спецификации. */
const DATA_FLAG: unique symbol = Symbol('data');
/** Имя сегмента (часть пути) этого узла. */
const SEGMENT: unique symbol = Symbol('segment');
/** Словарь дочерних узлов. Отсутствие свойства = лист. */
const CHILDREN: unique symbol = Symbol('children');
/** Ссылка на родительский узел или корень. */
const PARENT: unique symbol = Symbol('parent');


/** Словарь дочерних узлов: сегмент → узел. */
type Dict<D extends object, S extends string> = { [segment: string]: SymbolsNode<D, S> };


/** Структурная часть узла дерева: сегмент, связи и флаг данных.
 *
 * Data-узлы получаются пересечением `SymbolsNode & D` —
 * свойства данных живут непосредственно на объекте. */
type SymbolsNode<D extends object, S extends string> = {
    /** Имя узла (его часть пути). */
    [SEGMENT]: string;
    [PARENT]: NodeType<D, S> | SemanticRoot<D, S>;
    [DATA_FLAG]?: true;
    [CHILDREN]?: Dict<D, S>;
};


/** Синтетический корень иерархии.
 *
 * Не входит в результат {@linkcode Builder.build} —
 * служит общим `[PARENT]` для верхнеуровневых узлов.
 * 
 * Деталь реализации — не имеет смысла и семантики для потребителя.
 * */
type SemanticRoot<D extends object, S extends string> = {
    [SEGMENT]: S;
    [CHILDREN]: Dict<D, S>;
    [PARENT]: undefined;
};

// nominal typing для массива узлов, возвращаемого {@linkcode Builder.build()}
declare const __NodeArray: unique symbol;
/** Результат {@linkcode Builder.build} — массив узлов.
 *
 * Номинальная типизация предотвращает передачу произвольного `Array<NodeType>`. */
type NodeArrayType<D extends object, S extends string> = Array<NodeType<D, S>> & {
    readonly [__NodeArray]: never;
}


/** Type guard: является ли узел корневым (синтетическим). */
function isRoot<D extends object, S extends string>(node: NodeType<D, S> | SemanticRoot<D, S>): node is SemanticRoot<D, S> {
    return node[PARENT] === undefined;
}


/** Модуль построения иерархии из плоских путей.
 *
 * Принимает массив {@link Builder.SpecType | "спецификаций"} — путей вида `['a', 'b', 'c']` с данными —
 * и строит из них иерархию с общими префиксами.
 *
 * Порядок спецификаций не влияет на структуру иерархии:
 * `[a,b,c], [a,b]` и `[a,b], [a,b,c]` дадут идентичный результат.
 *
 * Дубликаты путей создают коллизию —
 * данные будут замещены (в DEBUG с предупреждением в лог).
 *
 * Спецификации с пустым массивом сегментов (`segments: []`) молча игнорируются —
 * не создают узлов и не влияют на остальную иерархию.
 *
 * @example
 * // Вход:
 * [
 *   { segments: ['build', 'dev'],  data: task1 },
 *   { segments: ['build', 'prod'], data: task2 },
 *   { segments: ['test'],          data: task3 }
 * ]
 * // Выход: [
 * //  ─ build
 * //    ├─ dev  [task1]
 * //    └─ prod [task2]
 * //  ─ test [task3]
 * // ]
 *
 * @example
 * // Узел может быть одновременно промежуточным и содержать данные:
 * [
 *   { segments: ['build'],        data: taskAll },
 *   { segments: ['build', 'dev'], data: taskDev }
 * ]
 * // Выход: [
 * //  ─ build [taskAll]
 * //    └─ dev [taskDev]
 * // ]
 *
 * ## Builder — "тупой" и **быстрый**
 *
 * {@linkcode Builder.build} должен быть быстрый построитель.
 * 
 * Проверка 500 сегментов по 500 символов на символ, крайне маловероятный
 * в "правильном" вводе — ненужное замедление.
 * 
 * Оптимизации дающие прирост в одном сценарри, но добавляющие оверхед
 * в других — не нужны.
 * 
 * */
const Builder = {

    /**  Построить иерархию из плоского списка {@linkcode Builder.SpecType | спецификаций}.
     *
     * Алгоритм: для каждой спецификации проходим по сегментам,
     * создавая узлы по мере необходимости (или повторно используя существующие).
     * Данные записываются в последний сегмент пути.
     *
     * @template D тип данных, записываемых в data-узлы.
     * @template S строковый scope — идентификатор области этой иерархии
     *
     * @param scopeId идентификатор области этой иерархии
     * @param specs массив {@link Builder.SpecType | спецификаций} (путь + данные)
     * @returns верхнеуровневые узлы построенной иерархии */
    build: function <D extends object, S extends string>(scopeId: S, specs: readonly SpecType<Readonly<D>>[]): Readonly<NodeArrayType<D, S>> {

        const rootNode = Object.create(null) as SemanticRoot<D, S>;
        rootNode[SEGMENT] = scopeId;
        // rootNode[PARENT] = undefined;
        rootNode[CHILDREN] = Object.create(null) as Dict<D, S>;

        // helper to create a node for a given parentPath and segment
        const createSeed = function (parent: SymbolsNode<D, S> | SemanticRoot<D, S>, segment: string): SymbolsNode<D, S> {
            const seed = Object.create(null) as SymbolsNode<D, S>;
            seed[SEGMENT] = segment;
            seed[PARENT] = parent;
            return seed;
        };

        // Обрабатываем массив спецификаций
        for (const { segments, data } of specs) {

            const firstSegment = segments.at(0);

            if (firstSegment === undefined) {
                // The number of segments is less than one
                continue;
            }

            let firstNode = rootNode[CHILDREN][firstSegment];
            if (!firstNode) {
                firstNode = createSeed(rootNode, firstSegment);
                rootNode[CHILDREN][firstSegment] = firstNode;
            }

            let current = firstNode;
            // traverse remaining segments
            for (let si = 1; si < segments.length; si++) {

                const segment = segments[si];

                // ensure children dict exists
                let dict: Dict<D, S> | undefined = current[CHILDREN]
                if (!dict) {
                    dict = Object.create(null) as Dict<D, S>;
                    current[CHILDREN] = dict;
                }

                // lazily создание child node в dict
                let childNode: SymbolsNode<D, S> | undefined = dict[segment];
                if (!childNode) {
                    childNode = createSeed(current, segment);
                    dict[segment] = childNode;
                }

                current = childNode;
            }

            // parent is the endpoint node for this spec; spread data onto it
            if (DATA_FLAG in current) {
                // #region DEBUG
                log(LogLevel.Warning, `Duplicate path in scope "${scopeId}": "${segments.join(' • ')}". Data was overwritten`);
                // #endregion DEBUG
                // должна быть перезапись! не мерж!
                for (const key of Reflect.ownKeys(current)) {
                    const STRUCT_SYMBOLS: ReadonlySet<symbol> = new Set([SEGMENT, CHILDREN, PARENT]);
                    if (typeof key === 'symbol' && STRUCT_SYMBOLS.has(key)) continue;
                    delete (current as Record<string | symbol, unknown>)[key];
                }
            }
            Object.assign(current, { [DATA_FLAG]: true, ...data });

        }

        return Object.values<NodeType<D, S>>(rootNode[CHILDREN]) as NodeArrayType<D, S>;
    },

    /** Найти узел в дереве по пути сегментов.
     *
     * @param topNodes верхнеуровневые узлы (результат {@linkcode Builder.build})
     * @param segments путь от корня к искомому узлу
     * @returns найденный узел или `undefined` */
    lookup: function <D extends object, S extends string>(topNodes: Readonly<NodeArrayType<D, S>>, segments: readonly string[]): Readonly<NodeType<D, S>> | undefined {

        if (segments.length === 0 || topNodes.length === 0) {
            return undefined;
        }

        const dict = topNodes[0][PARENT][CHILDREN]!;
        let current: NodeType<D, S> | undefined = dict[segments[0]];

        for (let si = 1; current && si < segments.length; si++) {
            current = current[CHILDREN]?.[segments[si]];
        }

        return current;
    },


    /** Дети узла, или пустой массив для листьев.
     *
     * Удобная альтернатива паре {@linkcode Builder.Node.isBranch} + {@linkcode Builder.Node.getBranchChildren},
     * когда ветвление не нужно обрабатывать отдельно. */
    getNodeChildren: function <D extends object, S extends string>(node: Readonly<NodeType<D, S>>): Array<Readonly<NodeType<D, S>>> {
        if (this.Node.isBranch(node)) {
            return Object.values<NodeType<D, S>>(node[CHILDREN]);
        }
        return [];
    },

    Node: {

        /** Имеет ли узел детей. Это проверка на свойство, НЕ тип.
         *
         * У чистых листьев ключа `children` нет вообще.
         * У нод с детьми (с полем `children`) всегда ≥ 1 ребёнок.
         *
         * "Чистый лист" = `!isBranch` — это всегда "DataNode", но "DataNode" — не всегда "чистый лист"  */
        isBranch: function <D extends object, S extends string>(node: Readonly<NodeType<D, S>>): node is Required<SymbolsNode<D, S>> {
            return CHILDREN in node;
        },


        /** Type guard: Содержит ли узел данные.
         *
         * (соответствует ли спецификации из {@linkcode build}).
         *
         * Это сужение не мешает узлу иметь свойство {@linkcode NodeType.isBranch}, и находиться в любой точке иерархии. */
        isData: function <D extends object, S extends string>(node: Readonly<NodeType<D, S>>): node is (SymbolsNode<D, S> & D) {
            return DATA_FLAG in node;
        },

        /** Имя узла — его сегмент пути. */
        getSegment: function <D extends object, S extends string>(node: Readonly<NodeType<D, S>>): string {
            return node[SEGMENT];
        },


        /** Разобрать путь узла на составляющие: scope и сегменты.
         *
         * @template D тип данных data-узлов
         * @template S строковый идентификатор scope
         *
         * @param node узел иерархии, построенной через {@linkcode Builder.build}
         * @returns объект, состоящий из scope и массива сегментов */
        resolvePath: function <D extends object, S extends string>(node: Readonly<NodeType<D, S>>): { scopeId: S, segments: string[]; } {
            const result: { scopeId: S, segments: string[]; } = {
                scopeId: '' as S,
                segments: [],
            };
            let current: NodeType<D, S> | SemanticRoot<D, S> = node;
            while (current) {
                if (isRoot(current)) {
                    result.scopeId = current[SEGMENT];
                    break;
                }
                result.segments.push(current[SEGMENT]);
                current = current[PARENT];
            }
            result.segments.reverse();
            return result;
        },


        /** Возвращает детей узла-контейнера.  
         * Метод доступен **только** для узлов, где `isBranch(node) === true`. */
        getBranchChildren: function <D extends object, S extends string>(node: Required<SymbolsNode<D, S>>): Array<Readonly<NodeType<D, S>>> {
            return Object.values<NodeType<D, S>>(node[CHILDREN]);
        },


        /** Родительский узел, или `undefined` если узел находится на верхнем уровне. */
        getParent: function <D extends object, S extends string>(node: Readonly<NodeType<D, S>>): Readonly<NodeType<D, S>> | undefined {
            const parent = node[PARENT] as NodeType<D, S> | SemanticRoot<D, S>;
            if (isRoot(parent)) {
                return undefined
            }
            return parent
        }

    } as const,
} as const;


namespace Builder {
    /** Спецификация ветки: путь (сегменты) + данные на конце. */
    export type Spec<D extends object> = SpecType<D>;
    /** Узел иерархии. */
    export type Node<D extends object, S extends string> = NodeType<D, S>;
}

export default Builder;
