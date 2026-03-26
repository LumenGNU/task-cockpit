/** @file Cockpit/Tree/Hierarchy.ts */
/** @module Hierarchy */

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG

// ---

/** Флаг: узел содержит данные из спецификации. */
const DATA_FLAG: unique symbol = Symbol('data');
/** Имя сегмента (часть пути) этого узла. */
const SEGMENT: unique symbol = Symbol('segment');
/** Словарь дочерних узлов. Отсутствие свойства = лист. */
const CHILDREN: unique symbol = Symbol('children');
/** Ссылка на родительский узел или корень. */
const PARENT: unique symbol = Symbol('parent');


/** Структурная часть узла дерева: сегмент, связи и флаг данных.
 *
 * Data-узлы получаются пересечением `SymbolsNode & D` —
 * свойства данных живут непосредственно на объекте. */
type SymbolsNode<D extends object, S extends string> = {
    /** Имя узла (его часть пути). */
    [SEGMENT]: string;
    [PARENT]: Hierarchy.ActuallyBranch<D, S> | SemanticRoot<D, S>;
    [DATA_FLAG]?: true;
    [CHILDREN]?: Hierarchy.Dict<D, S>;
};


/** Синтетический корень иерархии.
 *
 * Не входит в результат {@linkcode Hierarchy.build} —
 * служит общим `[PARENT]` для верхнеуровневых узлов.
 *
 * Деталь реализации — не имеет смысла и семантики для потребителя.
 * */
type SemanticRoot<D extends object, S extends string> = {
    [SEGMENT]: S;
    [CHILDREN]: Hierarchy.Dict<D, S>;
    [PARENT]: undefined;
};



/** Type guard: является ли узел корневым (синтетическим). */
function isTop<D extends object, S extends string>(node: Hierarchy.Node<D, S> | SemanticRoot<D, S>): node is SemanticRoot<D, S> {
    return node[PARENT] === undefined;
}


/** Модуль построения иерархии из плоских путей.
 *
 * Принимает массив {@link Hierarchy.Spec | "спецификаций"} — путей вида `['a', 'b', 'c']` с данными —
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
 * {@linkcode Hierarchy.build} должен быть быстрый построитель.
 *
 * Проверка 500 сегментов по 500 символов на символ, крайне маловероятный
 * в "правильном" вводе — ненужное замедление.
 *
 * Оптимизации дающие прирост в одном сценарии, но добавляющие overhead
 * в других — не нужны.
 *
 * */
const Hierarchy = {

    /**  Построить иерархию из плоского списка {@linkcode Hierarchy.Spec | спецификаций}.
     *
     * Алгоритм: для каждой спецификации проходим по сегментам,
     * создавая узлы по мере необходимости (или повторно используя существующие).
     * Данные записываются в последний сегмент пути.
     *
     * @template D тип данных, записываемых в data-узлы.
     * @template S строковый scope — идентификатор области этой иерархии
     *
     * @param scopeId идентификатор области этой иерархии
     * @param specs массив {@link Hierarchy.Spec | спецификаций} (путь + данные)
     * @returns верхнеуровневые узлы построенной иерархии */
    build<D extends object, S extends string>(
        scopeId: S,
        specs: ReadonlyArray<Readonly<Hierarchy.Spec<Readonly<D>>>>
    ): Readonly<Hierarchy.Dict<D, S>> {

        const rootNode = Object.create(null) as SemanticRoot<D, S>;
        rootNode[SEGMENT] = scopeId;
        // rootNode[PARENT] = undefined;
        rootNode[CHILDREN] = Object.create(null) as Hierarchy.Dict<D, S>;

        // helper to create a node for a given parentPath and segment
        const createSeed = function (parent: Hierarchy.ActuallyBranch<D, S> | SemanticRoot<D, S>, segment: string): SymbolsNode<D, S> {
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

            let parent = firstNode;
            // traverse remaining segments
            for (let si = 1; si < segments.length; si++) {

                const currentSegment = segments[si];

                // ensure children dict exists
                if (!Hierarchy.Node.isBranch(parent)) {
                    const dict = Object.create(null);
                    parent[CHILDREN] = dict as Hierarchy.Dict<D, S>;
                    // теперь приведение parent as ActuallyBranch<D, S> легитимно
                }

                const parentDict: Partial<Hierarchy.Dict<D, S>> = (parent as Hierarchy.ActuallyBranch<D, S>)[CHILDREN];

                // lazily создание child node в dict
                let childNode = parentDict[currentSegment];
                if (!childNode) {
                    // текущий сегмент еще не в родителе
                    // создаем узел и помещаем в родителя
                    childNode = createSeed((parent as Hierarchy.ActuallyBranch<D, S>), currentSegment);
                    parentDict[currentSegment] = childNode;
                }

                parent = childNode;
            }

            // parent is the endpoint node for this spec; spread data onto it
            if (DATA_FLAG in parent) {
                // #region DEBUG
                log(LogLevel.Warning, `Duplicate path in scope "${scopeId}": "${segments.join(' • ')}". Data was overwritten`);
                // #endregion DEBUG
                // должна быть перезапись, не слияние
                for (const key of Reflect.ownKeys(parent)) {
                    if (typeof key === 'symbol' && [DATA_FLAG, SEGMENT, CHILDREN, PARENT].includes(key)) continue;
                    delete (parent as Record<string | symbol, unknown>)[key];
                }
            }
            Object.assign(parent, { [DATA_FLAG]: true, ...data });

        }

        return Object.freeze(
            rootNode[CHILDREN]
        );
    },

    /** Найти узел в дереве по пути сегментов.
     *
     * @param topNodesDict верхнеуровневые узлы (результат {@linkcode Hierarchy.build})
     * @param segments путь от корня к искомому узлу
     * @returns найденный узел или `undefined` */
    lookup<D extends object, S extends string>(
        topNodesDict: Readonly<Hierarchy.Dict<D, S>>,
        segments: readonly string[]
    ): Readonly<Hierarchy.Node<D, S>> | undefined {

        if (segments.length === 0) {
            return undefined;
        }

        let current: Hierarchy.Node<D, S> | undefined = topNodesDict[segments[0]];

        for (let si = 1; current && si < segments.length; si++) {
            current = current[CHILDREN]?.[segments[si]];
        }

        return current;
    },


    Node: {

        /** Имеет ли узел детей. Это проверка на свойство, НЕ тип.
         *
         * У чистых листьев ключа `children` нет вообще.
         * У нод с детьми (с полем `children`) всегда ≥ 1 ребёнок.
         *
         * "Чистый лист" = `!isBranch` — это всегда "DataNode", но "DataNode" — не всегда "чистый лист"  */
        isBranch<D extends object, S extends string>(
            node: Readonly<Hierarchy.Node<D, S>>
        ): node is Hierarchy.ActuallyBranch<D, S> {
            return CHILDREN in node;
        },


        /** Type guard: Содержит ли узел данные.
         *
         * (соответствует ли спецификации из {@linkcode build}).
         *
         * Это сужение не мешает узлу иметь свойство {@linkcode Node.isBranch}, и находиться в любой точке иерархии. */
        isData<D extends object, S extends string>(node: Readonly<Hierarchy.Node<D, S>>): node is (SymbolsNode<D, S> & D) {
            return DATA_FLAG in node;
        },

        /** Имя узла — его сегмент пути. */
        getSegment<D extends object, S extends string>(node: Readonly<Hierarchy.Node<D, S>>): string {
            return node[SEGMENT];
        },


        /** Разобрать путь узла на составляющие: scope и сегменты.
         *
         * @template D тип данных data-узлов
         * @template S строковый идентификатор scope
         *
         * @param node узел иерархии, построенной через {@linkcode Hierarchy.build}
         * @returns объект, состоящий из scope и массива сегментов */
        resolvePath<D extends object, S extends string>(node: Readonly<Hierarchy.Node<D, S>>): { scopeId: S, segments: string[]; } {
            const result: { scopeId: S, segments: string[]; } = {
                scopeId: '' as S,
                segments: [],
            };
            let current: Hierarchy.Node<D, S> | SemanticRoot<D, S> = node;

            while (current) {

                if (isTop(current)) {
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
        getBranchChildren<D extends object, S extends string>(node: Readonly<Hierarchy.ActuallyBranch<D, S>>): Array<Readonly<Hierarchy.Node<D, S>>> {
            return Object.values<Hierarchy.Node<D, S>>(node[CHILDREN]);
        },


        /** Дети узла, или пустой массив для листьев.
         *
         * Удобная альтернатива паре {@linkcode Hierarchy.Node.isBranch} + {@linkcode Hierarchy.Node.getBranchChildren},
         * когда ветвление не нужно обрабатывать отдельно. */
        getChildren<D extends object, S extends string>(node: Readonly<Hierarchy.Node<D, S>>): Array<Readonly<Hierarchy.Node<D, S>>> {
            if (Hierarchy.Node.isBranch(node)) {
                return Object.values<Hierarchy.Node<D, S>>(node[CHILDREN]);
            }

            return [];
        },


        /** Родительский узел, или `undefined` если узел находится на верхнем уровне. */
        getParent<D extends object, S extends string>(node: Readonly<Hierarchy.Node<D, S>>): Hierarchy.ActuallyBranch<D, S> | undefined {

            const parent = node[PARENT];
            if (isTop(parent)) {
                return undefined;
            }

            return parent as Hierarchy.ActuallyBranch<D, S>;
        },

    } as const,
} as const;


// #region DEBUG
/** Сериализация дерева в plain-объект для отладки.
 *
 * Символьные ключи и циклические ссылки убраны —
 * результат безопасен для `JSON.stringify`. */
export function toDebugJSON<D extends object, S extends string>(
    topNodes: Readonly<Hierarchy.Dict<D, S>>
): Record<string, unknown> {

    function nodeToPlain(node: Hierarchy.Node<D, S>): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        if (Hierarchy.Node.isData(node)) {
            for (const key of Object.keys(node)) {
                result[key] = (node as Record<string, unknown>)[key];
            }
        }

        if (Hierarchy.Node.isBranch(node)) {
            const children: Record<string, unknown> = {};
            for (const child of Hierarchy.Node.getBranchChildren(node)) {
                children[Hierarchy.Node.getSegment(child)] = nodeToPlain(child);
            }
            result['[children]'] = children;
        }

        return result;
    }

    const root: Record<string, unknown> = {};
    for (const node of Object.values(topNodes)) {
        root[Hierarchy.Node.getSegment(node)] = nodeToPlain(node);
    }
    return root;
};
// #endregion DEBUG



declare namespace Hierarchy {

    /** Спецификация ветки: путь (сегменты) + данные на конце. */
    export interface Spec<D extends object> {
        segments: readonly string[];
        data: D;
    }

    /** Узел иерархии.
     *
     * Три варианта:
     * - данные, без детей (лист)
     * - данные и дети (промежуточный с данными)
     * - только дети, без данных (чисто группирующий)
     *
     * Узел без данных и без детей не существует.
     *
     * @see {@linkcode Hierarchy.Node.isData} — проверка наличия данных
     * @see {@linkcode Hierarchy.Node.isBranch} — проверка наличия детей */
    export type Node<D extends object, S extends string> = SymbolsNode<D, S> | (SymbolsNode<D, S> & D)

    // /** Результат {@linkcode Hierarchy.build} — массив узлов верхнего уровня.
    //  *
    //  * Номинальная типизация предотвращает передачу произвольного `Array<NodeType>`. */
    // export type TopNodeArray<D extends object, S extends string> = Array<Hierarchy.Node<D, S>> & {
    //     readonly [__NodeArray]: never;
    // }


    /** Словарь дочерних узлов: сегмент → узел. */
    export type Dict<D extends object, S extends string> = { [segment: string]: SymbolsNode<D, S>; };


    export type ActuallyBranch<D extends object, S extends string> = Hierarchy.Node<D, S> & { readonly [CHILDREN]: Dict<D, S>; }
}

export default Hierarchy;

