
import * as assert from 'node:assert/strict';
import CompressionBehavior from './CompressionBehavior';


interface Element {
    /** Область, отображаемая этой веткой */
    branchKey: string;
    /** Отображаемая метка */
    label: string;
    /** Уникальный id узла в дереве */
    id: string;
    data?: AnyData;
    children: Dict | null;
};


// не Object из за придурастой сортировки ключей похожих на числа
type Dict = Map<string, Element>;


type AnyData = Record<string, unknown>;


/** Спецификация узла: scope, путь (сегменты) и данные. */
interface Spec<D extends AnyData> {
    readonly segments: ReadonlyArray<string>;
    readonly data: D;
}


type Specs<D extends AnyData> = ReadonlyArray<Readonly<Spec<D>>>;


const SEP = '\x00\x00\x1F';


/** Строит ветку (суб-дерево) из списка {@linkcode Specs}.
 *
 * Каждый `spec` это путь (сегменты) с данными (data).
 *
 * Узлы появляются в ветке в порядке первого объявления в `specs`.
 * Если несколько спецификаций заканчиваются одним и тем же путём,
 * данные последней перезаписывают предыдущие.
 *
 * Три режима компрессии цепочек однодетных узлов:
 * - 'off' — без компрессии, каждый сегмент будет отдельным узлом
 * - 'on' — сжимает, если возможно, ветки-с-единственным-дитём, листья не трогает
 * - 'on-aggressive' — сжимает, если возможно, и ветки-с-единственным-листом тоже.
 *   Максимальная экономия пространства по вертикали за счёт увеличения "ширины".
 *
 * @template D тип данных, записываемых в runnable-узлы.
 *
 * @param props.branchPrefix Префикс, используемый для формирования идентификаторов
 *   корневых узлов. Идентификатор корневого узла строится как
 *   `branchPrefix + SEP + segment`. Для дочерних узлов идентификатор
 *   строится на основе родительского: `id_родителя + SEP + segment`.
 *   Должен быть уникальным среди всех веток дерева чтобы гарантировать
 *   уникальность id узлов.
 * @param props.branchKey Уникальный ключ ветки. Каждый созданный узел
 *   получит этот ключ в свойство `branchKey` для идентификации принадлежности
 *   к данной ветке.
 * @param props.specs Массив {@linkcode Spec | спецификаций} (путь + данные),
 *   из которых строится дерево. Порядок элементов определяет порядок
 *   создания узлов и перезаписи данных на листьях.
 * @param pathCompression Режим сжатия цепочек однодетных узлов (см. выше).
 * @returns {@link HierarchyModel.Dict | Словарь (Map)} верхнего уровня,
 *   представляющий корневые узлы построенной иерархии.
 *   Ключами являются метки сегментов, значениями — объекты {@link Element}.
 *   В зависимости от `pathCompression` дерево может быть оптимизировано.
 *  */
function buildHierarchy<D extends AnyData>(props: Readonly<{
    branchPrefix: string;
    branchKey: string;
    specs: Specs<D>;
}>,
    pathCompression: CompressionBehavior
): HierarchyModel.Dict {


    const topDict: Dict = new Map();

    if (props.specs.length < 1) {
        // нет структуры — пусто
        return topDict;
    }

    // Обрабатываем массив спецификаций
    for (const { segments: path, data } of props.specs) {

        // нет пути — ошибка входных данных
        assert.ok(path.length > 0, 'Specification error: path must contain at least one segment.');

        let currentChildren = topDict;
        let leafNode: Element | null = null;

        // traverse segments
        for (let i = 0; i < path.length; i++) {

            const segment = path.at(i);
            assert.ok(segment != null, 'Internal error: path segment is null or undefined while traversing.');
            let node = currentChildren.get(segment);

            if (!node) {
                node = {
                    label: segment,
                    id: leafNode
                        ? leafNode.id + SEP + segment
                        : props.branchPrefix + SEP + segment,
                    branchKey: props.branchKey,
                    children: null
                } satisfies Element;
                currentChildren.set(segment, node);
            }

            if (i < path.length - 1) {
                let children = node.children;
                if (!children) {
                    children = new Map();
                    node.children = children;
                }
                currentChildren = children;
            }

            leafNode = node;
        }

        // path.length ≥ 1, цикл for выполнился хотя бы раз:
        // parentNode точно != null
        assert.ok(leafNode, 'Internal error: failed to resolve leaf node after traversing path segments.');

        leafNode.data = data;

    }

    if (pathCompression === 'off') {
        return topDict;
    }

    return compressHierarchy(topDict, pathCompression);
}


declare namespace HierarchyModel {

    export type Dict = ReadonlyMap<string, HierarchyModel.Element>;

    export interface Element {
        // type: ElementType.RunnableNode;
        /** (*) Область, отображаемая этой веткой */
        readonly branchKey: string;
        /** (*) Отображаемая метка */
        readonly label: string;
        /** (*) Уникальный id узла в дереве */
        readonly id: string;
        readonly data?: Readonly<AnyData>;
        readonly children: HierarchyModel.Dict | null;
    }

    export type Specs<D extends AnyData> = Array<Spec<D>>;
}

const HierarchyModel = {
    buildHierarchy,
};

export default HierarchyModel;


// ------------------------

export type CompressionMode = 'on' | 'on-aggressive';

const LABEL_SEP = '\u2009›\u2009';

/** Сжать иерархию
 */
function compressHierarchy(
    dict: Dict,
    mode: CompressionMode,
): Dict {

    function compress(node: Element): Element {
        const chain: Element[] = [];
        let cur: Element = node;

        for (; ;) {
            chain.push(cur);
            if (
                cur.data !== undefined ||      // промежуточный runnable — стоп
                cur.children === null ||
                cur.children.size !== 1        // branch point или лист — стоп
            ) {
                break;
            }
            cur = cur.children.values().next().value!; // size === 1 проверена выше
        }

        const last = chain[chain.length - 1]!;

        const isRunnable = last.data != null;
        // const isGroup = last.children != null && last.children.size > 0;

        if (mode === 'on' && isRunnable && chain.length > 1) {
            // Терминальный узел не участвует в сжатии,
            // сжимаем только предшествующие узлы.
            // chain = [ ...intermediates, leaf ]
            // Сжимаем промежуточные; leaf остаётся дочерним узлом сжатого.
            // tail.children — это Map { leafKey → leaf } (size === 1 гарантирована
            // условием цикла: иначе мы бы остановились раньше).
            const body = chain.slice(0, -1);
            const tail = body[body.length - 1]!;
            return {
                branchKey: node.branchKey,
                label: body.map(n => n.label).join(LABEL_SEP),
                id: tail.id,
                children: tail.children
            };
        }

        // on-aggressive или branch point — вся цепочка → один узел,
        // дети last рекурсивно сжимаются.
        return {
            branchKey: node.branchKey,
            label: chain.map(n => n.label).join(LABEL_SEP),
            id: last.id,
            data: last.data,
            children: last.children && last.children.size > 0
                ? compressDict(last.children)
                : null,
        };
    }

    function compressDict(d: Dict): Dict {
        const result: Dict = new Map();
        for (const [key, node] of d) {
            result.set(key, compress(node));
        }
        return result;
    }

    return compressDict(dict);
}
