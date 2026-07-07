
import * as assert from 'node:assert/strict';
import CompressionBehavior from './CompressionBehavior';


type AnyData = Record<string, unknown>;


/** Карта дочерних узлов. */
const INNER_MAP: unique symbol = Symbol('children');
const DATA: unique symbol = Symbol('data');


class InnerMap<K, V> extends Map<K, V> {
    public get children(): ReadonlyArray<V> {
        return [...this.values()]; // @todo кешировать? или возвращать каждый раз новый?
    }
}

/** Внутренняя реализация узла дерева.
 *
 * **RW-интерфейс (внутри модуля):** мутируется напрямую через символьные поля
 * {@linkcode INNER_MAP} и {@linkcode DATA}. Символы не экспортируются — за пределами модуля
 * недостижимы, что даёт de-facto module-private доступ.
 *
 * **RO-интерфейс (потребитель):** структурно удовлетворяет {@linkcode HierarchyModel.Element}
 * (без явного `implements`) — геттеры `children` и `data` пробрасывают к символьным полям
 * только для чтения. */
class Element<D extends AnyData> {

    [INNER_MAP]: InnerMap<string, Element<D>> | null;
    [DATA]?: D;

    readonly branchKey: string;
    readonly label: string;
    readonly id: string;

    constructor(
        branchKey: string,
        label: string,
        id: string
    ) {
        this[INNER_MAP] = null;
        this.branchKey = branchKey;
        this.label = label;
        this.id = id;
    }

    get children(): ReadonlyArray<Element<D>> | null {
        return this[INNER_MAP]?.children ?? null;
    }

    get data(): Readonly<D> | null {
        return this[DATA] ?? null;
    }

}


/** Спецификация узла: scope, путь (сегменты) и данные. */
interface Spec<D extends AnyData> {
    readonly segments: ReadonlyArray<string>;
    readonly data: D;
}

/** Список спецификаций */
type Specs<D extends AnyData> = ReadonlyArray<Readonly<Spec<D>>>;


const SEP = '\x00\x00\x1F';


/** Построить иерархическую ветку по {@link Specs | списку спецификаций}.
 *
 * Где {@link Spec | каждая спецификация} из списка описывает путь в виде массива сегментов
 * и данные, которые должны быть записаны в узел, соответствующий последнему
 * сегменту пути.
 *
 * Узлы появляются в ветке в порядке первого объявления в `specs`.
 * Если несколько спецификаций заканчиваются одним и тем же путём,
 * данные последней перезаписывают предыдущие.
 *
 * Три режима компрессии цепочек однодетных узлов:
 * - 'off' — без сжатия, каждый сегмент становится отдельным узлом;
 * - 'on' — сжимает, если возможно, промежутки-без-данных-с-единственным-дитём.
 *     runnable-узлы не трогает — они всегда будут отдельными узлами;
 * - 'on-aggressive' — сжимает также и под-пути, ведущие к единственному
 *     runnable-узлу.
 *     Максимальная экономия пространства по вертикали за счёт увеличения
 *     "визуальной ширины".
 *
 * Для справки: никаких структурных гарантий у `id` нет. Алгоритм
 *   получения `id` описан намеренно поверхностно, и не является частью
 *   контракта. Единственная гарантия: "`id` будет уникальным среди всех
 *   элементов дерева, если `branchPrefix` уникальный среди веток, и только
 *   на «нормальных» данных". Других гарантий — НЕТ. Сейчас никаких проверок на
 *   коллизии при формировании `id` не выполняется.
 *
 * @template D Тип данных, хранимых в runnable-узлах.
 *
 * @param props Объект с параметрами построения:
 * - `branchPrefix` Префикс, используемый для формирования идентификаторов
 *     корневых узлов. Идентификатор корневого узла строится как
 *     `branchPrefix + уникальный_сегмент`. Для дочерних узлов идентификатор
 *     строится на основе родительского: `id_родителя + уникальный_сегмент`.
 *     Должен быть уникальным среди всех веток дерева чтобы гарантировать
 *     уникальность среди всех `id` узлов.
 * - `branchKey` Уникальный ключ ветки. Каждый созданный узел
 *     получит этот ключ в свойство `branchKey` для идентификации принадлежности
 *     к данной ветке. *Не обязан* быть уникальным среди *всех* веток, в отличии от
 *     `branchPrefix` — может быть одинаковым для «одинаковых» веток. (Как пример:
 *     полная ветка в основном дереве и структурно её часть в секции "закладки"
 *     того-же дерева).
 * - `specs` Массив {@linkcode Spec | спецификаций} (путь + данные),
 *     из которых строится дерево. Порядок элементов определяет порядок
 *     создания узлов и перезаписи данных на листьях.
 * @param pathCompression Режим сжатия цепочек однодетных узлов (см. выше).
 * @returns Иерархия, содержит узлы верхнего уровня — корень полученного под-дерева.
 *   В зависимости от `pathCompression` дерево может быть оптимизировано.
 *   Id узлов: никаких структурных гарантий у назначаемого `id` нет. Гарантируется
 *   только его уникальность для "нормальных" данных.
 *  */
function buildHierarchy<D extends AnyData>(props: Readonly<{
    branchPrefix: string;
    branchKey: string;
    specs: Specs<D>;
}>,
    pathCompression: CompressionBehavior
): HierarchyModel.Hierarchy<D> {
    // Как "движок" алгоритма задействована Map. Что удобно и нет "подножек" с порядком,
    // но:
    // Если применялось сжатие путей — ключи остаются равными исходным меткам первых
    // сегментов сжатой цепочки:
    // - Ключ по-прежнему точно идентифицирует первый сегмент исходного пути.
    // - Семантика ключа как «полного имени узла» — теряется. Теперь это «точки входа
    //   в возможный сжатый путь».
    // - Ключ больше не отражает полную метку узла — он становится короткой формой
    //   первого сегмента. Другими словами, разрушается инвариант `key ≡ label`,
    //   который выполнялся до сжатия.
    // Вытекает: ключи для потребителя — бесполезный мусор.
    // Из реального использования: потребителю нужны только дети:
    // `[...map.values()]`
    // Отсюда: Спрятать реализацию через Map за RO интерфейсом.
    // Поскольку семантика ключей для потребителя теряется,
    // да и он интересуется только значениями — спрятать карту за RO интерфейсом.
    // (На претензию "из js все равно можно все сломать" я отвечаю:
    // "этот код на ts, не js. ReadonlyMap — такая же фикция,
    // как и модификатор private. И что? Перестать ими пользоваться?")

    const topDict = new InnerMap<string, Element<D>>();

    if (props.specs.length < 1) {
        // нет структуры — пусто
        return topDict;
    }

    // Обрабатываем массив спецификаций
    for (const { segments: path, data } of props.specs) {

        // нет пути — ошибка входных данных
        assert.ok(path.length > 0, 'Specification error: path must contain at least one segment.');

        let currentChildren = topDict;
        let leafNode: Element<D> | null = null;

        // обход сегментов
        for (let i = 0; i < path.length; i++) {

            const segment = path.at(i);
            assert.ok(segment != null, 'Internal error: path segment is null or undefined while traversing.');
            let node = currentChildren.get(segment);

            if (!node) {
                node = new Element<D>(
                    /*branchKey*/ props.branchKey,
                    /*label*/ segment,
                    /*id*/ leafNode
                        ? leafNode.id + SEP + segment
                        : props.branchPrefix + SEP + segment
                );
                currentChildren.set(segment, node);
            }

            if (i < path.length - 1) {
                let children = node[INNER_MAP];
                if (!children) {
                    children = new InnerMap();
                    node[INNER_MAP] = children;
                }
                currentChildren = children;
            }

            leafNode = node;
        }

        // path.length ≥ 1, цикл for выполнился хотя бы раз:
        // parentNode точно != null
        assert.ok(leafNode, 'Internal error: failed to resolve leaf node after traversing path segments.');

        leafNode[DATA] = data;

    }

    if (pathCompression === 'off') {
        return topDict;
    }

    return compressHierarchy(topDict, pathCompression);
}

// Этот интерфейс отдается потребителю для использования.
declare namespace HierarchyModel {

    /** Иерархия, содержит узлы верхнего уровня (корень под-дерева).
     *  Объект с единственным полем `children` — массивом корневых узлов. */
    export type Hierarchy<D extends AnyData> = Readonly<{
        children: ReadonlyArray<Element<D>>;
    }>;

    /** Read-only представление узла дерева.
     *
     * - branchKey: ключ ветки, указывающий принадлежность узла к ветке;
     * - label: метка (сегмент) или составная метка после сжатия;
     * - id: уникальный идентификатор узла (структурных гарантий нет, см. реализацию);
     * - data: данные узла или null, если это чистый промежуточный узел;
     * - children: массив дочерних узлов или null, если это чистый листовой узел.
     *  */
    export interface Element<D extends AnyData> {
        readonly branchKey: string;
        readonly label: string;
        readonly id: string;
        /** Данные узла (null, если отсутствуют) */
        readonly data: Readonly<D> | null;
        /** Дочерние узлы, массив элементов. Или null */
        readonly children: ReadonlyArray<Readonly<Element<D>>> | null;
    }

    export type Specs<D extends AnyData> = Array<Spec<D>>;
}

const HierarchyModel = {
    buildHierarchy
};

export default HierarchyModel;


// ------------------------

export type CompressionMode = 'on' | 'on-aggressive';

const LABEL_SEP = '\u2009›\u2009';

/** Сжать иерархию "по высоте", если возможно.
 *
 * Функция принимает внутреннюю карту корневых узлов (`InnerMap`) и режим сжатия.
 *
 * Возвращает новую `InnerMap`, где некоторые цепочки сегментов, при возможности,
 * объединены между собою в составные узлы.
 *
 * Объединенные узлы получают составную метку — значение всех `label`, участвовавших
 * в объединении, соединенных через {@linkcode LABEL_SEP}. И id от последнего узла
 * участвовавшего в объединении.
 *
 * При режиме 'on' терминальные узлы с данными не включаются в сжатие (они остаются
 * отдельными узлами).
 *
 * В режиме 'on-aggressive' сжимаются и такие ветки.
 * */
function compressHierarchy<D extends AnyData>(
    dict: InnerMap<string, Element<D>>,
    mode: CompressionMode
): InnerMap<string, Element<D>> {

    function compress(node: Element<D>): Element<D> {
        const chain: Element<D>[] = [];
        let cur: Element<D> = node;

        for (; ;) {
            chain.push(cur);
            if (
                cur[DATA] != null || // runnable — стоп
                cur[INNER_MAP] == null || cur[INNER_MAP].size !== 1 // branch point или лист — стоп
            ) {
                break;
            }
            cur = cur[INNER_MAP].values().next().value!; // size === 1 проверена выше
        }

        const last = chain.at(-1)!;

        if (mode === 'on' && last[DATA] != null && chain.length > 1) {
            // Терминальный узел не участвует в сжатии,
            // сжимаем только предшествующие узлы.
            // chain = [ ...intermediates, leaf ]
            // Сжимаем промежуточные; leaf остаётся дочерним узлом сжатого.
            // tail.children — это Map { leafKey → leaf } (size === 1 гарантирована
            // условием цикла: иначе мы бы остановились раньше).
            const body = chain.slice(0, -1);
            const tail = body.at(-1)!;

            // tail — всегда узел без данных (иначе мы бы не попали в этот блок сжатия)
            // эта ветвь сжатия обрабатывает только промежуточные узлы, не содержащие данных.
            // Таким образом копировать данные (data) не нужно
            assert.ok(tail[DATA] == null, 'Invariant violated: tail must not contain data.');

            // tail — это chain[chain.length - 2],
            // то есть узел, мимо которого цикл уже прошёл.
            // Значит, на момент прохождения сработало условие продолжения цикла:
            // tail.data == null, tail.children != null, tail.children.size === 1.
            // Ситуация tail.children → null недостижима, но tsc пох — он видит тип InnerMap | null
            assert.ok(tail[INNER_MAP] != null, 'Invariant violated: tail.children must be non-null here');

            const element = new Element<D>(
                node.branchKey,
                body.map(n => n.label).join(LABEL_SEP),
                tail.id
            );
            element[INNER_MAP] = compressDict(tail[INNER_MAP]);

            return element;
        }

        // mode === 'on-aggressive' или
        // mode === 'on', !isRunnable (branch point или лист) или
        // mode === 'on', chain.length === 1 (один runnable-узел с несколькими детьми)
        // тогда → дети last рекурсивно сжимаются.

        const element = new Element<D>(
            node.branchKey,
            chain.map(n => n.label).join(LABEL_SEP),
            last.id
        );

        element[INNER_MAP] = last[INNER_MAP] != null
            ? compressDict(last[INNER_MAP])
            : null;

        if (last[DATA] != null) {
            element[DATA] = last[DATA];
        }

        return element;
    }

    function compressDict(d: InnerMap<string, Element<D>>): InnerMap<string, Element<D>> {
        const result: InnerMap<string, Element<D>> = new InnerMap();
        for (const [key, node] of d) {
            result.set(key, compress(node));
        }
        return result;
    }

    return compressDict(dict);
}
