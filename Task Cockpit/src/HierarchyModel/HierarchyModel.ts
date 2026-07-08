
import * as assert from 'node:assert/strict';
import CompressionBehavior from './CompressionBehavior';


type AnyData = Record<string, unknown>;


/** Карта дочерних узлов. */
const INNER_MAP: unique symbol = Symbol('children');
const DATA: unique symbol = Symbol('data');


class InnerMap<K, V> extends Map<K, V> {
    #children: ReadonlyArray<V> | null = null;
    public get children(): ReadonlyArray<V> {
        return this.#children ??= [...this.values()]; // @todo или возвращать каждый раз новый?
    }
}

/** Внутренняя реализация узла дерева.
 *
 * **RW-интерфейс (внутри модуля):** мутируется напрямую через символьные поля
 * {@linkcode INNER_MAP} и {@linkcode DATA}. Символы не экспортируются — за пределами модуля
 * недостижимы, что даёт de-facto module-private доступ.
 *
 * **RO-интерфейс (потребитель):** реализует {@linkcode HierarchyModel.Element}
 *  — геттеры `children` и `data` пробрасывают к символьным полям
 * только для чтения. */
class Element<K extends string, D extends AnyData> implements HierarchyModel.Element<K, D> {

    [INNER_MAP]: InnerMap<string, Element<K, D>> | null;
    [DATA]?: D;

    readonly label: string;
    // Никаких гарантий на структуру потребителю не даю.
    // Реализация формирования не прозрачна.
    // Реализация формирования может меняться.
    readonly id: string;

    constructor(
        id: string,
        label: string,
    ) {
        this[INNER_MAP] = null;
        this.label = label;
        this.id = id;
    }

    get children(): ReadonlyArray<Element<K, D>> | null {
        // @todo assert если INNER_MAP != null то INNER_MAP.size > 0
        return this[INNER_MAP]?.children ?? null;
    }

    get data(): Readonly<D> | null {
        return this[DATA] ?? null;
    }

    get branchKey(): K {
        return this.id.split(SEP).at(0)! as K;
    }

}


/** Спецификация узла: scope, путь (сегменты) и данные. */
interface Spec<D extends AnyData> {
    readonly segments: ReadonlyArray<string>;
    readonly data: D;
}


/** Список спецификаций */
type Specs<K extends string, D extends AnyData> = ReadonlyMap<K, ReadonlyArray<Readonly<Spec<D>>>>;


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
 * - ~`branchPrefix` Префикс, используемый для формирования идентификаторов
 *     корневых узлов. Идентификатор корневого узла строится как
 *     `branchPrefix + уникальный_сегмент`. Для дочерних узлов идентификатор
 *     строится на основе родительского: `id_родителя + уникальный_сегмент`.
 *     Должен быть уникальным среди всех веток дерева чтобы гарантировать
 *     уникальность среди всех `id` узлов.~
 * - `branchKey` Уникальный ключ ветки. Каждый созданный узел
 *     получит этот ключ в свойство `branchKey` для идентификации принадлежности
 *     к данной ветке. *~Не~ обязан* быть уникальным среди *всех* веток~, в отличии от
 *     `branchPrefix` — может быть одинаковым для «одинаковых» веток. (Как пример:
 *     полная ветка в основном дереве и структурно её часть в секции "закладки"
 *     того-же дерева).~
 * - `specs` Массив {@linkcode Spec | спецификаций} (путь + данные),
 *     из которых строится дерево. Порядок элементов определяет порядок
 *     создания узлов и перезаписи данных на листьях.
 * @param pathCompression Режим сжатия цепочек однодетных узлов (см. выше).
 * @returns Иерархия, содержит узлы верхнего уровня — корень полученного под-дерева.
 *   В зависимости от `pathCompression` дерево может быть оптимизировано.
 *   Id узлов: никаких структурных гарантий у назначаемого `id` нет. Гарантируется
 *   только его уникальность для "нормальных" данных.
 *  */
function buildHierarchy<K extends string, D extends AnyData>(
    specs: Specs<K, D>,
    pathCompression: CompressionBehavior
): HierarchyModel.Hierarchy<K, D> {


    const hierarchy = new Map();

    if (specs.size < 1) {
        // нет структуры — пусто
        return hierarchy;
    }

    // Обход карты, построение иерархии для каждой ветки
    for (const [branchKey, specsList] of specs) {

        const topDict = new InnerMap<string, Element<K, D>>();

        // Обрабатываем массив спецификаций
        for (const { segments, data } of specsList) {

            // нет пути — ошибка входных данных
            assert.ok(segments.length > 0, 'Specification error: path must contain at least one segment.');

            let currentChildren = topDict;
            let leafNode: Element<K, D> | null = null;

            // обход сегментов
            for (let i = 0; i < segments.length; i++) {

                const segment = segments.at(i);
                assert.ok(segment != null, 'Internal error: path segment is null or undefined while traversing.');
                let node = currentChildren.get(segment);

                if (!node) {
                    node = new Element<K, D>(
                    /*id*/ leafNode
                            ? leafNode.id + SEP + segment
                            : branchKey + SEP + segment,
                    /*label*/ segment,
                    );
                    currentChildren.set(segment, node);
                }

                if (i < segments.length - 1) {
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

        hierarchy.set(
            branchKey,
            pathCompression !== 'off'
                ? compressHierarchy(topDict, pathCompression)
                : topDict
        );
    }


    return hierarchy;
}

// Этот интерфейс отдается потребителю для использования.
declare namespace HierarchyModel {

    /** Иерархия, содержит узлы верхнего уровня (корень под-дерева)
     * сгруппированные по ключам веток.
     *  Объект с единственным полем `children` — массивом корневых узлов. */
    export type Hierarchy<K extends string, D extends AnyData> = ReadonlyMap<K, Readonly<{
        children: ReadonlyArray<Element<K, D>>;
    }>>;

    /** Read-only представление узла дерева.
     *
     * - branchKey: ключ ветки, указывающий принадлежность узла к ветке;
     * - label: метка (сегмент) или составная метка после сжатия;
     * - id: уникальный идентификатор узла (структурных гарантий нет, см. реализацию);
     * - data: данные узла или null, если это чистый промежуточный узел;
     * - children: массив дочерних узлов или null, если это чистый листовой узел.
     *  */
    export interface Element<K extends string, D extends AnyData> {
        readonly branchKey: K;
        readonly label: string;
        readonly id: string;
        /** Данные узла (null, если отсутствуют) */
        readonly data: Readonly<D> | null;
        /** Дочерние узлы, массив элементов. Или null */
        readonly children: ReadonlyArray<Readonly<Element<K, D>>> | null;
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
function compressHierarchy<K extends string, D extends AnyData>(
    dict: InnerMap<string, Element<K, D>>,
    mode: CompressionMode
): InnerMap<string, Element<K, D>> {

    function compress(node: Element<K, D>): Element<K, D> {
        const chain: Element<K, D>[] = [];
        let cur: Element<K, D> = node;

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

            const element = new Element<K, D>(
                tail.id,
                body.map(n => n.label).join(LABEL_SEP)
            );
            element[INNER_MAP] = compressDict(tail[INNER_MAP]);

            return element;
        }

        // mode === 'on-aggressive' или
        // mode === 'on', !isRunnable (branch point или лист) или
        // mode === 'on', chain.length === 1 (один runnable-узел с несколькими детьми)
        // тогда → дети last рекурсивно сжимаются.

        const element = new Element<K, D>(
            last.id,
            chain.map(n => n.label).join(LABEL_SEP)
        );

        element[INNER_MAP] = last[INNER_MAP] != null
            ? compressDict(last[INNER_MAP])
            : null;

        if (last[DATA] != null) {
            element[DATA] = last[DATA];
        }

        return element;
    }

    function compressDict(d: InnerMap<string, Element<K, D>>): InnerMap<string, Element<K, D>> {
        const result: InnerMap<string, Element<K, D>> = new InnerMap();
        for (const [key, node] of d) {
            result.set(key, compress(node));
        }
        return result;
    }

    return compressDict(dict);
}
