/** @file Cockpit/Tree/Hierarchy.ts */
/** @module Hierarchy */

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


// =================================


/** Структурная часть узла дерева.
 *
 * Data-узлы получаются пересечением ` & D` —
 * свойства данных живут непосредственно на объекте. */
interface Node<D extends object, S extends string> {
    [SEGMENT]: S | string;
    [PARENT]: Hierarchy.Branch<D, S> | undefined;
    [CHILDREN]?: ChildrenDict<D, S>;
    [DATA_FLAG]?: true | never;
}


/** Флаг: узел содержит данные из спецификации. */
const DATA_FLAG: unique symbol = Symbol('data');
/** Имя сегмента (часть пути) этого узла. */
const SEGMENT: unique symbol = Symbol('segment');
/** Словарь дочерних узлов. */
const CHILDREN: unique symbol = Symbol('children');
/** Ссылка на родительский узел или корень. */
const PARENT: unique symbol = Symbol('parent');


/** Иерархия: словарь scope → корневой узел области. */
type Hierarchy<D extends object, S extends string> = {
    [scope in S]: Hierarchy.Scope<D, S>;
};


/** Словарь дочерних узлов: сегмент → узел. */
type ChildrenDict<D extends object, S extends string> = {
    [segment: string]: Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>;
};


/** Модуль построения иерархии из плоских путей.
 *
 * Принимает массив {@link Spec | "спецификаций"} — путей вида `[id, a, b, c]` с данными —
 * и строит из них иерархию с общими префиксами.
 *
 * Порядок спецификаций не влияет на структуру иерархии:
 * `[id, a,b,c], [a,b]` и `[id, a,b], [id, a,b,c]` дадут идентичный результат.
 *
 * Дубликаты путей создают коллизию —
 * данные будут замещены (в DEBUG с предупреждением в лог).
 *
 * Спецификации с пустым массивом сегментов (`segments: []`) молча игнорируются —
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
 *     build<D extends object, S extends string>(
 *         specs: ReadonlyArray<Readonly<Hierarchy.Spec<D, S>>>
 *     ): Hierarchy<D, S>
 *     ~~~
 * 
 * - Все scope-узлы иерархии
 *     ~~~
 *     getScopes<D extends object, S extends string>(
 *         hierarchy: Hierarchy<D, S>
 *     ): ReadonlyArray<Hierarchy.Scope<D, S>>
 *     ~~~
 * 
 * - Scope-узел по идентификатору
 *     ~~~
 *     getScope<D extends object, S extends string>(
 *         hierarchy: Hierarchy<D, S>,
 *         scopeId: S
 *     ): Hierarchy.Scope<D, S> | undefined
 *     ~~~
 * 
 * - Обход всех узлов иерархии
 *     ~~~
 *     walk<D extends object, S extends string>(
 *         hierarchy: Hierarchy<D, S>,
 *         visitor: (node: Readonly<Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>>) => void
 *     ): void
 *     ~~~
 * 
 * - Поиск узла по полному пути
 *     ~~~
 *     lookup<D extends object, S extends string>(
 *         hierarchy: Hierarchy<D, S>,
 *         scope: S,
 *         path: readonly string[]
 *     ): Hierarchy.Branch<D, S> | Hierarchy.Data<D, S> | undefined
 *     ~~~
 * 
 * - (DEBUG) Сериализация иерархии обратно в плоский массив {@linkcode Hierarchy.Spec}
 *     ~~~
 *     toJSON<D extends object>(
 *         hierarchy: Hierarchy<D, string>
 *     ): Array<Hierarchy.Spec<D, string>>
 *     ~~~
 * 
 * - (DEBUG) Текстовое представление иерархии (ASCII-дерево)
 *     ~~~
 *     printTree<D extends object, S extends string>(
 *         hierarchy: Hierarchy<D, S>,
 *         formatter: (data: D) => string = () => '(*)'
 *     ): string
 *     ~~~
 * 
 * 
 * #### `Hierarchy.Scope`
 * 
 * - Идентификатор области
 *     ~~~
 *     getScopeId<D extends object, S extends string>(
 *         scope: Hierarchy.Scope<D, S>
 *     ): S
 *     ~~~
 * 
 * - Дочерние узлы первого уровня в scope
 *     ~~~
 *     getChildren<D extends object, S extends string>(
 *         scope: Hierarchy.Scope<D, S>
 *     ): Array<Readonly<Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>>>
 *     ~~~
 * 
 * - Обход всех узлов scope в глубину
 *     ~~~
 *     walk<D extends object, S extends string>(
 *         scope: Hierarchy.Scope<D, S>,
 *         visitor: (node: Readonly<Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>>) => void
 *     ): void
 *     ~~~
 * 
 * - (DEBUG) Текстовое представление области (ASCII-дерево)
 *     ~~~
 *     printTree<D extends object, S extends string>(
 *         children: ReadonlyArray<Readonly<Hierarchy.Branch<D, S> | Hierarchy.Data<D, S>>>,
 *         formatter: (data: D) => string = () => '(*)',
 *         basePrefix: string = '  '
 *     ): string
 *     ~~~
 * 
 * 
 * #### `Hierarchy.Node`
 * 
 * - Type guard: узел является данными ( & D)
 *     ~~~
 *     isData<D extends object, S extends string>(
 *         node: Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>
 *     ): node is Hierarchy.Data<D, S>
 *     ~~~
 * 
 * - Type guard: узел имеет дочерние элементы
 *     ~~~
 *     isBranch<D extends object, S extends string>(
 *         node: Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>
 *     ): node is Hierarchy.Branch<D, S>
 *     ~~~
 * 
 * - Type guard: является ли узел корневым
 *     ~~~
 *     isScope<D extends object, S extends string>(
 *         node: Node<D, S>
 *     ): node is Hierarchy.Scope<D, S>
 *     ~~~
 * 
 * - Имя сегмента этого узла (последняя часть пути)
 *     ~~~
 *     getSegment<D extends object, S extends string>(
 *         node: Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>
 *     ): string
 *     ~~~
 * 
 * - Чистые данные узла, без структурных полей иерархии
 *     ~~~
 *     getData<D extends object, S extends string>(
 *         node: Hierarchy.Data<D, S>
 *     ): D
 *     ~~~
 * 
 * - Родительский узел. Для узлов первого уровня возвращает scope
 *     ~~~
 *     getParent<D extends object, S extends string>(
 *         node: Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>
 *     ): Hierarchy.Branch<D, S> | Hierarchy.Scope<D, S>
 *     ~~~
 * 
 * - Дочерние узлы ветки
 *     ~~~
 *     getBranchChildren<D extends object, S extends string>(
 *         node: Hierarchy.Branch<D, S>
 *     ): Array<Readonly<Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>>>
 *     ~~~
 * 
 * - Восстановление полного пути от узла до scope
 *     ~~~
 *     resolvePath<D extends object, S extends string>(
 *         node: Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>
 *     ): { scope: S; path: string[]; }
 *     ~~~
 * 
 * - Обход поддерева в глубину (pre-order), включая сам узел
 *     ~~~
 *     walk<D extends object, S extends string>(
 *         node: Hierarchy.Branch<D, S>,
 *         visitor: (child: Readonly<Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>>) => void
 *     ): void
 *     ~~~
 * 
 * @example
 * ~~~ts
 * type MenuData = { calories: number; note?: string };
 *
 * const hierarchy = Hierarchy.build<MenuData, 'kitchen'>([
 *     { scope: 'kitchen', path: ['pizza', 'margherita'], data: { calories: 250 } },
 *     { scope: 'kitchen', path: ['pizza', 'quattro formaggi'], data: { calories: 320 } },
 *     { scope: 'kitchen', path: ['pizza', 'diavola'], data: { calories: 290 } },
 *     { scope: 'kitchen', path: ['pizza'], data: { calories: 0, note: 'dough base' } }, // данные + дети
 *     { scope: 'kitchen', path: ['sushi', 'nigiri', 'salmon'], data: { calories: 45 } },
 *     { scope: 'kitchen', path: ['sushi', 'nigiri', 'tuna'], data: { calories: 40 } },
 *     { scope: 'kitchen', path: ['sushi', 'roll', 'dragon'], data: { calories: 500 } },
 *     { scope: 'kitchen', path: ['sushi', 'roll', 'rainbow'], data: { calories: 470 } },
 *     { scope: 'kitchen', path: ['sushi', 'gunkan'], data: { calories: 60 } },  // лист на уровне группирующих
 *     { scope: 'kitchen', path: ['taco'], data: { calories: 210 } },            // одиночный лист, без вложенности
 *     { scope: 'kitchen', path: ['ramen', 'tonkotsu'], data: { calories: 450 } },
 *     { scope: 'kitchen', path: ['ramen', 'miso'], data: { calories: 380 } },
 * ]);
 * ~~~
 * 
 * построит такую структуру:
 * 
 * ~~~
 * ─ [kitchen]
 *   ├─ pizza ( calories: 0 )
 *   │  ├─ margherita ( calories: 250 )
 *   │  ├─ quattro formaggi ( calories: 320 )
 *   │  └─ diavola ( calories: 290 )
 *   ├─ sushi
 *   │  ├─ nigiri
 *   │  │  ├─ salmon ( calories: 45 )
 *   │  │  └─ tuna ( calories: 40 )
 *   │  ├─ roll
 *   │  │  ├─ dragon ( calories: 500 )
 *   │  │  └─ rainbow ( calories: 470 )
 *   │  └─ gunkan ( calories: 60 )
 *   ├─ taco ( calories: 210 )
 *   └─ ramen
 *      ├─ tonkotsu ( calories: 450 )
 *      └─ miso ( calories: 380 )
 * ~~~
 *
 *  */
declare namespace Hierarchy {

    /** Спецификация узла: scope, путь (сегменты) и данные. */
    export interface Spec<D extends object, S extends string> {
        readonly scope: S,
        readonly path: ReadonlyArray<string>;
        readonly data: D;
    }

    /** Узел-ветка: имеет дочерние узлы. */
    export type Branch<D extends object, S extends string> = Node<D, S> & {
        [SEGMENT]: string;
        [CHILDREN]: ChildrenDict<D, S>;
        [PARENT]: Branch<D, S>;
    };

    /** Корневой узел области (scope). Служит контейнером для верхнеуровневых узлов.
     * Не содержит данных ({@linkcode DATA_FLAG} = `never`). */
    export type Scope<D extends object, S extends string> = Node<D, S> & {
        [SEGMENT]: S;
        [CHILDREN]: ChildrenDict<D, S>;
        [PARENT]: undefined;
        [DATA_FLAG]?: never;
    };

    /** Узел с данными из спецификации. Может также иметь дочерние узлы. */
    export type Data<D extends object, S extends string> = Node<D, S> & D & {
        [SEGMENT]: string;
        [CHILDREN]?: ChildrenDict<D, S>;
        [DATA_FLAG]: true;
        [PARENT]: Branch<D, S>;
    };

}


const Hierarchy = {

    /**  Построить иерархию из плоского списка {@linkcode Hierarchy.Spec | спецификаций}.
     *
     * Алгоритм: для каждой спецификации проходим по сегментам,
     * создавая узлы по мере необходимости (или повторно используя существующие).
     * Данные записываются в последний сегмент пути.
     * 
     * @note Если передать узел из другой иерархии как payload (D),
     * его символьные структурные поля останутся на объекте
     * и будут конфликтовать с новой иерархией.
     * Используйте {@linkcode Hierarchy.Node.getData} для извлечения
     * чистого payload перед повторным использованием.
     *
     * @template D тип данных, записываемых в data-узлы.
     * @template S строковый scope — идентификатор области этой иерархии.
     *
     * @param specs массив {@link Hierarchy.Spec | спецификаций} (путь + данные)
     * @returns верхнеуровневые узлы построенной иерархии */
    build<D extends object, S extends string>(
        specs: ReadonlyArray<Readonly<Hierarchy.Spec<D, S>>>
    ): Hierarchy<D, S> {

        const scopeDict = Object.create(null) as Hierarchy<D, S>;

        if (specs.length < 1) {
            return Object.freeze(scopeDict);
        }

        // Обрабатываем массив спецификаций
        for (const { scope, path, data } of specs) {

            let scopeNode = scopeDict[scope];
            if (scopeNode === undefined) {
                scopeNode = Object.create(null) as Hierarchy.Scope<D, S>;
                scopeNode[SEGMENT] = scope;
                scopeNode[PARENT] = undefined;
                scopeNode[CHILDREN] = Object.create(null) as ChildrenDict<D, S>;
                scopeDict[scope] = scopeNode;
            }

            let parentNode: Node<D, S> = scopeNode;

            // traverse remaining segments
            for (const segment of path) {

                // lazily создание child node в dict
                let childNode = parentNode[CHILDREN]?.[segment];
                if (childNode === undefined) {

                    // текущий сегмент еще не в родителе
                    // создаем узел и помещаем в родителя
                    childNode = Object.create(null) as Hierarchy.Branch<D, S> | Hierarchy.Data<D, S>;
                    childNode[SEGMENT] = segment;
                    childNode[PARENT] = parentNode as Hierarchy.Branch<D, S>;

                    let parentChildren = parentNode[CHILDREN];
                    // ensure children dict exists
                    if (parentChildren === undefined) {
                        parentChildren = Object.create(null) as ChildrenDict<D, S>;
                        parentNode[CHILDREN] = parentChildren;
                    }

                    parentChildren[segment] = childNode;
                }

                parentNode = childNode;
            }

            // parent is the endpoint node for this spec; spread data onto it
            if (DATA_FLAG in parentNode) {
                // #region DEBUG
                log(LogLevel.Warning, `Duplicate path in scope "${scope}": "${path.join(' › ')}". Data was overwritten`);
                // #endregion DEBUG
                // должна быть перезапись, не слияние
                for (const key in parentNode) {
                    delete (parentNode as any)[key];
                }
            }
            Object.assign(parentNode, { ...data, [DATA_FLAG]: true });

        }

        return Object.freeze(scopeDict);
    },

    /** Все scope-узлы иерархии. */
    getScopes<D extends object, S extends string>(
        hierarchy: Hierarchy<D, S>
    ): ReadonlyArray<Hierarchy.Scope<D, S>> {
        return Object.values(hierarchy);
    },

    /** Scope-узел по идентификатору, или `undefined` если отсутствует. */
    getScope<D extends object, S extends string>(
        hierarchy: Hierarchy<D, S>,
        scopeId: S
    ): Hierarchy.Scope<D, S> | undefined {
        return hierarchy[scopeId];
    },


    /** Обход всех узлов иерархии (все scope, в глубину, pre-order).
     * @param visitor вызывается для каждого узла; третий аргумент — scope, которому принадлежит узел */
    walk<D extends object, S extends string>(
        hierarchy: Hierarchy<D, S>,
        visitor: (node: Readonly<Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>>) => void
    ): void {

        for (const scope in hierarchy) {
            Hierarchy.Scope.walk(
                hierarchy[scope],
                visitor
            );
        }
    },


    /** Поиск узла по полному пути.
     * Возвращает `undefined`, если путь не существует. */
    lookup<D extends object, S extends string>(
        hierarchy: Hierarchy<D, S>,
        scope: S,
        path: ReadonlyArray<string>
    ): Hierarchy.Branch<D, S> | Hierarchy.Data<D, S> | undefined {

        const scopeNode = hierarchy[scope];
        if (!scopeNode) {
            return undefined;
        }

        let current:
            | Hierarchy.Branch<D, S>
            | Hierarchy.Data<D, S>
            | undefined
            = undefined;

        let dict:
            | ChildrenDict<D, S>
            | undefined
            = scopeNode[CHILDREN];

        for (const segment of path) {
            current = dict?.[segment];
            if (!current) {
                return undefined;
            }
            dict = current[CHILDREN];
        }

        return current;
    },

    // #region DEBUG

    /** Сериализация иерархии обратно в плоский массив {@linkcode Hierarchy.Spec}.
     * Обходит все scope, собирая только data-узлы. */
    toJSON<D extends object>(
        hierarchy: Hierarchy<D, string>
    ): Array<Hierarchy.Spec<D, string>> {

        const result: Array<Hierarchy.Spec<D, string>> = [];

        for (const scope of Hierarchy.getScopes(hierarchy)) {

            Hierarchy.Scope.walk(scope, (node) => {

                if (!Hierarchy.Node.isData(node)) return;

                const { scope, path } = Hierarchy.Node.resolvePath(node);
                const data = Hierarchy.Node.getData(node);

                result.push({ scope, path, data });
            });
        }

        return result;
    },

    /** Текстовое представление иерархии (ASCII-дерево) для отладки.
     * @param formatter форматирование данных узла в строку (по умолчанию `'(*)'`) */
    printTree<D extends object, S extends string>(
        hierarchy: Hierarchy<D, S>,
        formatter: (data: D) => string = () => '(*)'
    ): string {

        return Hierarchy.getScopes(hierarchy)
            .map(scope => `─ [${scope[SEGMENT]}]\n${Hierarchy.Scope.printTree(Object.values(scope[CHILDREN]), formatter, '  ')}`)
            .join('\n');
    },
    // #endregion DEBUG

    Scope: {

        /** Идентификатор области. */
        getScopeId<D extends object, S extends string>(
            scope: Hierarchy.Scope<D, S>
        ): S {
            return scope[SEGMENT];
        },

        /** Дочерние узлы первого уровня в scope. */
        getChildren<D extends object, S extends string>(
            scope: Hierarchy.Scope<D, S>
        ): Array<Readonly<Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>>> {
            return Object.values(scope[CHILDREN]);
        },

        /** Обход всех узлов scope в глубину (pre-order).
         * @param visitor вызывается для каждого узла с текущей глубиной
         * @param depth начальная глубина (по умолчанию 1) */
        walk<D extends object, S extends string>(
            scope: Hierarchy.Scope<D, S>,
            visitor: (node: Readonly<Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>>) => void
        ): void {

            for (const child of Object.values(scope[CHILDREN])) {

                if (Hierarchy.Node.isBranch(child)) {
                    Hierarchy.Node.walk(child, visitor);
                }
                else {
                    visitor(child);
                }
            }
        },

        // #region DEBUG

        printTree<D extends object, S extends string>(
            children: ReadonlyArray<Readonly<Hierarchy.Branch<D, S> | Hierarchy.Data<D, S>>>,
            formatter: (data: D) => string = () => '(*)',
            basePrefix: string = '  '
        ): string {

            const lines: string[] = [];

            function printNode(
                node: Hierarchy.Branch<D, S> | Hierarchy.Data<D, S>,
                prefix: string,
                isLast: boolean,
            ): void {
                const connector = isLast ? '└─' : '├─';
                const dataMarker = Hierarchy.Node.isData(node) ? formatter(node) : '';
                lines.push(`${prefix}${connector} ${node[SEGMENT]} ${dataMarker}`);

                if (Hierarchy.Node.isBranch(node)) {
                    const childPrefix = prefix + (isLast ? '   ' : '│  ');
                    const children = Object.values(node[CHILDREN]);
                    for (let i = 0; i < children.length; i++) {
                        printNode(children[i], childPrefix, i === children.length - 1);
                    }
                }
            }

            for (let i = 0; i < children.length; i++) {
                printNode(children[i], basePrefix, i === children.length - 1);
            }

            return lines.join('\n');
        },

        // #endregion DEBUG
    },

    Node: {

        /** Type guard: узел является данными ( & D). */
        isData<D extends object, S extends string>(
            node: Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>
        ): node is Hierarchy.Data<D, S> {
            return DATA_FLAG in node;
        },

        /** Type guard: узел имеет дочерние элементы. */
        isBranch<D extends object, S extends string>(
            node: Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>
        ): node is Hierarchy.Branch<D, S> {
            return CHILDREN in node;
        },

        /** Type guard: является ли узел корневым. */
        isScope<D extends object, S extends string>(
            node: Node<D, S>
        ): node is Hierarchy.Scope<D, S> {
            return node[PARENT] === undefined;
        },

        /** Имя сегмента этого узла (последняя часть пути). */
        getSegment<D extends object, S extends string>(
            node: Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>
        ): string {
            return node[SEGMENT];
        },

        /** Чистые данные узла, без структурных полей иерархии.
         *
         * Узел внутренне несёт структурные свойства (segment, parent, children).
         * Если передать узел напрямую как payload в другой {@linkcode Hierarchy.build} —
         * эти свойства останутся на объекте и будут конфликтовать
         * с новой иерархией. `getData` возвращает только пользовательский payload,
         * безопасный для повторного использования. (Смотри реализацию `Section::makeFavoriteSpecs`).
         * 
         * В большинстве случаев не нужен — структурные поля узла хранятся
         * под символами и не пересекаются с пользовательскими данными,
         * поэтому обращаться к данным можно напрямую: `Hierarchy.Node.isData(node) && node.tag`.
         *  */
        getData<D extends object, S extends string>(
            node: Hierarchy.Data<D, S>
        ): D {
            const data = Object.create(null) as D;
            for (const key in node) {
                (data as any)[key] = (node as any)[key];
            }
            return data;
        },

        /** Родительский узел. Для узлов первого уровня возвращает scope. */
        getParent<D extends object, S extends string>(
            node: Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>
        ): Hierarchy.Branch<D, S> | Hierarchy.Scope<D, S> {
            return node[PARENT];
        },

        /** Дочерние узлы ветки. */
        getBranchChildren<D extends object, S extends string>(
            node: Hierarchy.Branch<D, S>
        ): Array<Readonly<Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>>> {
            return Object.values(node[CHILDREN]);
        },

        /** Восстановление полного пути от узла до scope (подъём по PARENT-цепочке).
         * @returns scopeId и массив сегментов от корня к узлу */
        resolvePath<D extends object, S extends string>(
            node: Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>
        ): { scope: S; path: Array<string>; } {

            const path: string[] = [];
            let current = node;

            // Поднимаемся до scope, собирая сегменты
            while (true) {
                path.push(current[SEGMENT]);
                const ref = current[PARENT];
                if (Hierarchy.Node.isScope(ref)) {
                    path.reverse();
                    return { scope: ref[SEGMENT], path };
                }
                current = ref;
            }
        },

        /** Обход поддерева в глубину (pre-order), включая сам узел.
         * @param visitor вызывается для каждого узла с текущей глубиной
         * @param depth начальная глубина (по умолчанию 1) */
        walk<D extends object, S extends string>(
            node: Hierarchy.Branch<D, S>,
            visitor: (child: Readonly<Hierarchy.Data<D, S> | Hierarchy.Branch<D, S>>) => void
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