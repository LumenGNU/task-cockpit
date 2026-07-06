
import * as assert from 'node:assert/strict';
import CompressionBehavior from './CompressionBehavior';


interface Element {
    branchKey: string;
    label: string;
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
 * - 'on' — сжимает, если возможно, промежутки-без-данных-с-единственным-дитём.
 *   Узлы с данныи не трогает — они всегда будут отдельными листьями.
 * - 'on-aggressive' — сжимает, если возможно, и ветки-с-единственным-листом-с-данными
 *   тоже. Максимальная экономия пространства по вертикали за счёт увеличения "ширины".
 *
 * @template D тип данных, записываемых в runnable-узлы.
 *
 * @param props.branchPrefix Префикс, используемый для формирования идентификаторов
 *   корневых узлов. Идентификатор корневого узла строится как
 *   `branchPrefix + уникальный_сегмент`. Для дочерних узлов идентификатор
 *   строится на основе родительского: `id_родителя + уникальный_сегмент`.
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
 *   Ключами являются метки сегментов, значениями — объекты {@linkcode Element}.
 *   В зависимости от `pathCompression` дерево может быть оптимизировано.
 *   Если применялось сжатие путей — ключи остаются равными исходным меткам первых
 *   сегментов сжатой цепочки:
 *   - Ключ по-прежнему точно идентифицирует первый сегмент исходного пути.
 *   - Семантика ключа как «полного имени узла» — теряется. Теперь это «точки входа
 *     в возможный сжатый путь».
 *   - Ключ больше не отражает полную метку узла — он становится короткой формой
 *     первого сегмента. Другими словами, разрушается инвариант `key ≡ label`,
 *     который выполнялся до сжатия.
 *   Id узлов: никаких структурных гарантий у назначаемого `id` нет. Гарантируется
 *   только его уникальность для "нормальных" данных. Никаких проверок на коллизии
 *   при формировании `id` не выполняется.
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

        // обход сегментов
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
        /** Ветка, к которой принадлежит элемент */
        readonly branchKey: string;
        /** Отображаемая метка */
        readonly label: string;
        /** Уникальный id узла в дереве */
        readonly id: string;
        /** Полезная нагрузка элемента */
        readonly data?: Readonly<AnyData>;
        /** Дети. Не пустая карта, если есть. Если нет детей — null. */
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
                cur.data != null || // промежуточный runnable — стоп
                cur.children == null || cur.children.size !== 1 // branch point или лист — стоп
            ) {
                break;
            }
            cur = cur.children.values().next().value!; // size === 1 проверена выше
        }

        const last = chain.at(-1)!;

        if (mode === 'on' && last.data != null && chain.length > 1) {
            // Терминальный узел не участвует в сжатии,
            // сжимаем только предшествующие узлы.
            // chain = [ ...intermediates, leaf ]
            // Сжимаем промежуточные; leaf остаётся дочерним узлом сжатого.
            // tail.children — это Map { leafKey → leaf } (size === 1 гарантирована
            // условием цикла: иначе мы бы остановились раньше).
            const body = chain.slice(0, -1);
            const tail = body.at(-1)!;

            // tail — это chain[chain.length - 2],
            // то есть узел, мимо которого цикл уже прошёл.
            // Значит, на момент прохождения сработало условие продолжения цикла:
            // tail.data == null, tail.children != null, tail.children.size === 1.
            // Ситуация tail.children → null недостижима, но tsc пох — он видит тип Element.children: Dict | null
            assert.ok(tail.children != null, 'Invariant violated: tail.children must be non-null here');

            return {
                branchKey: node.branchKey,
                label: body.map(n => n.label).join(LABEL_SEP),
                id: tail.id,
                children: compressDict(tail.children)
            };
        }

        // mode === 'on-aggressive' или
        // mode === 'on', !isRunnable (branch point или лист) или
        // mode === 'on', chain.length === 1 (один runnable-узел с несколькими детьми)
        // тогда → дети last рекурсивно сжимаются.
        return {
            branchKey: node.branchKey,
            label: chain.map(n => n.label).join(LABEL_SEP),
            id: last.id,
            data: last.data,
            children: last.children != null
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
