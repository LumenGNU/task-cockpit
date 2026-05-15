/** @file Cockpit/TreeModel/Hierarchy.ts */
/** @module Hierarchy */

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


// =================================


// interface AnyData {
//     [k: string]: unknown;
// };

type AnyData = Record<string, unknown>;

/** Структурная часть узла дерева.
 *
 * Data-узлы получаются пересечением ` & D` —
 * свойства данных живут непосредственно на объекте. */
interface Node<D extends AnyData> {
    [SEGMENT]: string;
    [PARENT]: Hierarchy.Branch<D> | null;
    [CHILDREN]: ChildrenDict<D> | null;
    [DATA_FLAG]: boolean;
}


/** Флаг: узел содержит данные из спецификации. */
const DATA_FLAG: unique symbol = Symbol('data');
/** Имя сегмента (часть пути) этого узла. */
const SEGMENT: unique symbol = Symbol('segment');
/** Словарь дочерних узлов. */
const CHILDREN: unique symbol = Symbol('children');
/** Ссылка на родительский узел или корень. */
const PARENT: unique symbol = Symbol('parent');



/** Словарь дочерних узлов: сегмент → узел. */
type ChildrenDict<D extends AnyData> = Record<string, Hierarchy.Data<D> | Hierarchy.Branch<D>>;


/** Спецификация узла: scope, путь (сегменты) и данные. */
interface Spec<D extends AnyData> {
    readonly path: ReadonlyArray<string>;
    readonly data: D;
}


/** Модуль построения иерархии из плоских путей.
 *
 * Принимает массив {@link Hierarchy.Spec | "спецификаций"} — путей вида `[a, b, c]` с данными —
 * и строит из них иерархию с общими префиксами.
 * Возвращает словарь верхнеуровневых узлов.
 *
 * Порядок спецификаций не влияет на структуру иерархии:
 * `[a,b,c], [a,b]` и `[a,b], [a,b,c]` дадут идентичный результат.
 *
 * Дубликаты путей создают коллизию —
 * данные будут замещены (в DEBUG с предупреждением в лог).
 *
 * Спецификации с пустым массивом сегментов (`path: []`) молча игнорируются —
 * не создают узлов и не влияют на остальную иерархию.
 *
 * ### Builder — "тупой" и "**быстрый**"
 *
 * - {@linkcode Hierarchy.build} должен быть быстрый построитель.
 * - Проверка 500 сегментов по 500 символов на символ, крайне маловероятный
 *   в "правильном" вводе — ненужное замедление.
 * - Оптимизации дающие прирост в одном сценарии, но добавляющие overhead
 *   в других — не нужны.
 *
 * ### API
 *
 *
 * #### `Hierarchy`
 *
 * - Построить иерархию из плоского списка {@linkcode Hierarchy.Spec | спецификаций}
 *     ~~~
 *     build<D extends object>(
 *         specs: ReadonlyArray<Readonly<Hierarchy.Spec<D>>>
 *     ): Readonly<ChildrenDict<Readonly<D>>>
 *     ~~~
 *
 * - Верхнеуровневые узлы иерархии
 *     ~~~
 *     getRoots<D extends object>(
 *         hierarchy: ChildrenDict<D>
 *     ): ReadonlyArray<Readonly<Hierarchy.Data<D> | Hierarchy.Branch<D>>>
 *     ~~~
 *
 * - Поиск узла по полному пути
 *     ~~~
 *     lookup<D extends object>(
 *         hierarchy: ChildrenDict<D>,
 *         path: ReadonlyArray<string>
 *     ): Hierarchy.Branch<D> | Hierarchy.Data<D> | null
 *     ~~~
 *
 * - Обход всех узлов иерархии в глубину
 *     ~~~
 *     walk<D extends object>(
 *         hierarchy: ChildrenDict<D>,
 *         visitor: (node: Readonly<Hierarchy.Data<D> | Hierarchy.Branch<D>>) => void
 *     ): void
 *     ~~~
 *
 *
 * #### `Hierarchy.Node`
 *
 * - Type guard: узел является данными ( & D)
 *     ~~~
 *     isData<D extends object>(
 *         node: Hierarchy.Data<D> | Hierarchy.Branch<D>
 *     ): node is Hierarchy.Data<D>
 *     ~~~
 *
 * - Type guard: узел имеет дочерние элементы
 *     ~~~
 *     isBranch<D extends object>(
 *         node: Hierarchy.Data<D> | Hierarchy.Branch<D>
 *     ): node is Hierarchy.Branch<D>
 *     ~~~
 *
 * - Имя сегмента этого узла (последняя часть пути)
 *     ~~~
 *     getSegment<D extends object>(
 *         node: Hierarchy.Data<D> | Hierarchy.Branch<D>
 *     ): string
 *     ~~~
 *
 * - Чистые данные узла, без структурных полей иерархии
 *     ~~~
 *     getData<D extends object>(
 *         node: Hierarchy.Data<D>
 *     ): D
 *     ~~~
 *
 * - Родительский узел. Для корневых узлов возвращает `null`
 *     ~~~
 *     getParent<D extends object>(
 *         node: Hierarchy.Data<D> | Hierarchy.Branch<D>
 *     ): Hierarchy.Branch<D> | null
 *     ~~~
 *
 * - Дочерние узлы ветки
 *     ~~~
 *     getBranchChildren<D extends object>(
 *         node: Hierarchy.Branch<D>
 *     ): Array<Readonly<Hierarchy.Data<D> | Hierarchy.Branch<D>>>
 *     ~~~
 *
 * - Восстановление полного пути от корня до узла (подъём по PARENT-цепочке)
 *     ~~~
 *     resolvePath<D extends object>(
 *         node: Hierarchy.Data<D> | Hierarchy.Branch<D>
 *     ): Array<string>
 *     ~~~
 *
 * - Обход поддерева в глубину (pre-order), включая сам узел
 *     ~~~
 *     walk<D extends object>(
 *         node: Hierarchy.Branch<D>,
 *         visitor: (child: Readonly<Hierarchy.Data<D> | Hierarchy.Branch<D>>) => void
 *     ): void
 *     ~~~
 *
 * @example
 * ~~~ts
 * type MenuData = { calories: number; note?: string };
 *
 * const hierarchy = Hierarchy.build<MenuData>([
 *     { path: ['pizza', 'margherita'], data: { calories: 250 } },
 *     { path: ['pizza', 'quattro formaggi'], data: { calories: 320 } },
 *     { path: ['pizza', 'diavola'], data: { calories: 290 } },
 *     { path: ['pizza'], data: { calories: 0, note: 'dough base' } }, // данные + дети
 *     { path: ['sushi', 'nigiri', 'salmon'], data: { calories: 45 } },
 *     { path: ['sushi', 'nigiri', 'tuna'], data: { calories: 40 } },
 *     { path: ['sushi', 'roll', 'dragon'], data: { calories: 500 } },
 *     { path: ['sushi', 'roll', 'rainbow'], data: { calories: 470 } },
 *     { path: ['sushi', 'gunkan'], data: { calories: 60 } },  // лист на уровне группирующих
 *     { path: ['taco'], data: { calories: 210 } },            // одиночный лист, без вложенности
 *     { path: ['ramen', 'tonkotsu'], data: { calories: 450 } },
 *     { path: ['ramen', 'miso'], data: { calories: 380 } },
 * ]);
 * ~~~
 *
 * построит такую структуру:
 *
 * ~~~
 * ─ pizza ( calories: 0 )
 *   ├─ margherita ( calories: 250 )
 *   ├─ quattro formaggi ( calories: 320 )
 *   └─ diavola ( calories: 290 )
 * ─ sushi
 *   ├─ nigiri
 *   │  ├─ salmon ( calories: 45 )
 *   │  └─ tuna ( calories: 40 )
 *   ├─ roll
 *   │  ├─ dragon ( calories: 500 )
 *   │  └─ rainbow ( calories: 470 )
 *   └─ gunkan ( calories: 60 )
 * ─ taco ( calories: 210 )
 * ─ ramen
 *   ├─ tonkotsu ( calories: 450 )
 *   └─ miso ( calories: 380 )
 * ~~~
 *
 *  */
declare namespace Hierarchy {

    /** Узел-ветка: имеет дочерние узлы. */
    export type Branch<D extends AnyData> = Omit<Node<D>, typeof DATA_FLAG | typeof CHILDREN> & {
        [CHILDREN]: ChildrenDict<D>;
        [DATA_FLAG]: boolean;
    };

    /** Узел с данными из спецификации. Может также иметь дочерние узлы. */
    export type Data<D extends AnyData> = Omit<Node<D>, typeof DATA_FLAG> & D & {
        [DATA_FLAG]: true;
    };

}


const Hierarchy = {

    /** Построить иерархию из плоского списка {@linkcode Hierarchy.Spec | спецификаций}.
     *
     * Алгоритм: для каждой спецификации проходим по сегментам,
     * создавая узлы по мере необходимости (или повторно используя существующие).
     * Данные записываются в последний сегмент пути.
     *
     * @note Если передать узел из другой иерархии как payload (D),
     * его символьные структурные поля останутся на объекте
     * и будут конфликтовать с новой иерархией.
     * Используй {@linkcode Hierarchy.Node.getData} для извлечения
     * чистого payload перед повторным использованием.
     *
     * @template D тип данных, записываемых в data-узлы.
     *
     * @param specs массив {@link Hierarchy.Spec | спецификаций} (путь + данные)
     * @returns верхнеуровневые узлы построенной иерархии */
    build<D extends AnyData>(
        specs: ReadonlyArray<Readonly<Spec<D>>>
    ): Readonly<ChildrenDict<Readonly<D>>> {

        const topDict = Object.create(null) as ChildrenDict<D>;

        if (specs.length < 1) {
            return topDict;
        }

        // Обрабатываем массив спецификаций
        for (const { path, data } of specs) {

            if (path.length < 1) {
                continue;
            }

            let currentChildren = topDict;
            let parentNode: Node<D> | null = null;

            // traverse segments
            for (let i = 0; i < path.length; i++) {

                const segment = '\0' + path[i];
                let node = currentChildren[segment];

                if (node === undefined) {
                    node = Object.create(null) as Hierarchy.Data<D> | Hierarchy.Branch<D>;
                    node[SEGMENT] = segment;
                    node[PARENT] = parentNode as Hierarchy.Branch<D> | null;
                    node[CHILDREN] = null;
                    node[DATA_FLAG] = false;

                    currentChildren[segment] = node;
                }

                parentNode = node;

                if (i < path.length - 1) {

                    let children = parentNode[CHILDREN];

                    if (children === null) {
                        children = Object.create(null) as ChildrenDict<D>;
                        parentNode[CHILDREN] = children;
                    }

                    currentChildren = children;
                }
            }

            // path.length ≥ 1, цикл for выполнился хотя бы раз:
            // parentNode точно !== null

            // parentNode является конечным узлом для данной спецификации.
            // назначаем ему данные
            if (parentNode![DATA_FLAG]) {
                // #region DEBUG
                log(LogLevel.Warning, `Duplicate path: "${path.join(' › ')}". Data was overwritten`);
                // #endregion DEBUG
                // должна быть перезапись, не слияние
                for (const key of Object.keys(parentNode!)) {
                    delete (parentNode as unknown as Record<string, unknown>)[key];
                }
            }

            parentNode![DATA_FLAG] = true;
            Object.assign(parentNode!, data);

        }

        return topDict;
    },



    /** Поиск узла по полному пути.
     * Возвращает `null`, если путь не существует. */
    lookup<D extends AnyData>(
        hierarchy: ChildrenDict<D>,
        path: ReadonlyArray<string>
    ): Hierarchy.Branch<D> | Hierarchy.Data<D> | null {
        let current:
            | Hierarchy.Branch<D>
            | Hierarchy.Data<D>
            | null
            = null;
        let dict:
            | ChildrenDict<D>
            | null
            = hierarchy;
        for (const segment of path) {
            current = dict?.['\0' + segment] ?? null;
            if (!current) {
                return null;
            }
            dict = current[CHILDREN];
        }
        return current;
    },

    /** Вернуть верхнеуровневые узлы иерархии.
     *
     * @param hierarchy корневой словарь, возвращённый {@linkcode build}
     * @returns узлы первого уровня в порядке вставки */
    getRoots<D extends AnyData>(
        hierarchy: ChildrenDict<D>
    ): Array<
        Readonly<Hierarchy.Data<D> | Hierarchy.Branch<D>>
    > {
        return Object.values(hierarchy);
    },

    /** Обойти все узлы иерархии в глубину.
     *
     * @param hierarchy корневой словарь, возвращённый {@linkcode build}
     * @param visitor вызывается для каждого узла */
    walk<D extends AnyData>(
        hierarchy: ChildrenDict<D>,
        visitor: (child: Readonly<Hierarchy.Data<D> | Hierarchy.Branch<D>>) => void
    ): void {

        for (const root of Hierarchy.getRoots(hierarchy)) {
            if (Hierarchy.Node.isBranch(root)) {
                Hierarchy.Node.walk(root, visitor);
            }
            else {
                visitor(root);
            }
        }
    },


    Node: {

        /** Type guard: узел является данными ( & D). */
        isData<D extends AnyData>(
            node: Hierarchy.Data<D> | Hierarchy.Branch<D>
        ): node is Hierarchy.Data<D> {
            return node[DATA_FLAG];
        },

        /** Type guard: узел имеет дочерние элементы. */
        isBranch<D extends AnyData>(
            node: Hierarchy.Data<D> | Hierarchy.Branch<D>
        ): node is Hierarchy.Branch<D> {
            return node[CHILDREN] !== null;
        },


        /** Имя сегмента этого узла (последняя часть пути). */
        getSegment<D extends AnyData>(
            node: Hierarchy.Data<D> | Hierarchy.Branch<D>
        ): string {
            // .slice(1) нужен для избавления от '\0' в начале
            // смотри bug: integer index sorting in plain object
            return node[SEGMENT].slice(1);
        },

        /** Чистые данные узла, без структурных полей иерархии.
         *
         * Узел внутренне несёт структурные свойства (segment, parent, children).
         * Если передать узел напрямую как payload в другой {@linkcode Hierarchy.build} —
         * эти свойства останутся на объекте и будут конфликтовать
         * с новой иерархией. `getData` возвращает только пользовательский payload,
         * безопасный для повторного использования. (Смотри реализацию `Section::makePinnedSpecs`).
         *
         * В большинстве остальных случаев не нужен — структурные поля узла хранятся
         * под символами и не пересекаются с пользовательскими данными,
         * поэтому обращаться к данным можно напрямую: `Hierarchy.Node.isData(node) && node.tag`. */
        getData<D extends AnyData>(
            node: Hierarchy.Data<D>
        ): D {
            const data = Object.create(null) as AnyData;
            for (const key in node) {
                data[key] = node[key];
            }
            return data as D;
        },

        /** Родительский узел. Для узлов верхнего уровня (корней) возвращает null. */
        getParent<D extends AnyData>(
            node: Hierarchy.Data<D> | Hierarchy.Branch<D>
        ): Hierarchy.Branch<D> | null {
            return node[PARENT];
        },

        /** Дочерние узлы ветки. */
        getBranchChildren<D extends AnyData>(
            node: Hierarchy.Branch<D>
        ): Array<Readonly<Hierarchy.Data<D> | Hierarchy.Branch<D>>> {
            return Object.values(node[CHILDREN]);
        },

        /** Возвращает количество дочерних узлов */
        childCount<D extends AnyData>(node: Hierarchy.Branch<D>): number {
            const children = node[CHILDREN];
            if (!children) {
                return 0;
            }
            let count: number = 0;
            let _;
            for (_ in children) { count++; };
            return count;
        },

        /** True — если количество дочерних узлов больше одного */
        hasMultipleChildren<D extends AnyData>(node: Hierarchy.Branch<D>): boolean {
            const children = node[CHILDREN];
            if (!children) {
                return false;
            }
            let found = false;
            for (const _ in children) {
                if (found) {
                    return true;
                }
                found = true;
            }
            return false;
        },


        /** Дочерние узлы сегмента. */
        getChildren<D extends AnyData>(
            node: Hierarchy.Data<D> | Hierarchy.Branch<D>
        ): Array<Readonly<Hierarchy.Data<D> | Hierarchy.Branch<D>>> {
            const children = node[CHILDREN];
            return children ? Object.values(children) : [];
        },

        /** Восстановление полного пути от корня до узла (подъём по PARENT-цепочке).
         * @returns массив сегментов от корня к узлу */
        resolvePath<D extends AnyData>(
            node: Hierarchy.Data<D> | Hierarchy.Branch<D>
        ): Array<string> {

            const path: string[] = [];
            let current = node;

            // Поднимаемся до корня, собирая сегменты
            while (true) {
                path.push(Hierarchy.Node.getSegment(current));
                const ref = current[PARENT];
                if (!ref) {
                    path.reverse();
                    return path;
                }
                current = ref;
            }
        },

        /** Обход поддерева в глубину (pre-order), включая сам узел.
         * @param visitor вызывается для каждого узла с текущей глубиной */
        walk<D extends AnyData>(
            node: Hierarchy.Branch<D>,
            visitor: (child: Readonly<Hierarchy.Data<D> | Hierarchy.Branch<D>>) => void
        ): void {

            visitor(node);

            for (const child of Object.values(node[CHILDREN])) {
                if (Hierarchy.Node.isBranch(child)) {
                    Hierarchy.Node.walk(child, visitor);
                }
                else {
                    visitor(child);
                }
            }
        },
    },
} as const;


export default Hierarchy;
