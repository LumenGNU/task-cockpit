import { DISPLAY_ITEM_SEPARATOR } from '../constants';
import Hierarchy from './Hierarchy';
import Splitter from './Splitter';
import type ScopedConf from '../Configuration/Scoped/Config';
import TaskGroup from '../Scope/TaskSource/Definitions/Definition/TaskGroup';


/** Спецификация узла: путь (сегменты) и данные. */
interface NodeSpec<D extends NodeData> {
    readonly path: ReadonlyArray<string>;
    readonly data: D;
}


interface NodeData {
    readonly [key: string]: unknown;
}


type HierarchyConf = ScopedConf['Hierarchy'];
export type CompressionBehavior = "off" | "on" | "on-aggressive";

/** Преобразует индекс определений узлов в индекс спецификаций для построения иерархии.
 *
 * Принимает плоскую структуру и возвращает структурированную — где у каждого
 * элемента уже есть явный path.
 *
 * #### Режимы компрессии путей
 *
 * При `compression === 'off'` пути строятся напрямую через {@linkcode buildPath}.
 *
 * При `'on'` и `'on-aggressive'`: все элементы
 * участвуют в построении временного trie, после чего пути сжимаются через
 * {@linkcode buildCompressedPath}. Линейные участки склеиваются в один сегмент;
 * `'on-aggressive'` дополнительно трактует runnable-узлы как точки разреза.
 *
 * @param entries Плоский список пар `[name, data]`. `name` — полное имя элемента
 *   (например `build:dev:watch`); разбивается по `segmentSeparator` в сегменты пути.
 *   `data` — полезная нагрузка, которая оседает в листьях результирующих спецификаций.
 * @returns Индекс спецификаций: по одной записи {@linkcode SpecEntry} на каждый ключ входного индекса.
 * */
function createSpecs<D extends NodeData>({
    entries,
    hierarchyConfig: hierarchyConf,
    pathCompression
}: {
    entries: ReadonlyArray<Readonly<[name: string, groupKind: TaskGroup | null, data: D]>>;
    hierarchyConfig: Readonly<HierarchyConf>;
    pathCompression: CompressionBehavior;
}): Readonly<ReadonlyArray<Readonly<NodeSpec<D>>>> {

    const specs: NodeSpec<D>[] = [];

    const { segmentSeparator } = hierarchyConf;
    const splitter = Splitter.create(segmentSeparator);

    if (pathCompression === 'off') {

        for (const entry of entries) {

            const data = entry.at(-1) as D;
            const segments = entry.slice(0, -1) as [name: string, groupKind: TaskGroup | null];

            specs.push({
                path: buildPath(segments, hierarchyConf, splitter),
                data
            });
        }
    }
    else {

        const rawSpecs = entries.map(function (entry) {
            const data = entry.at(-1) as D;
            const segments = entry.slice(0, -1) as [name: string, groupKind: TaskGroup | null];
            return {
                path: buildPath(segments, hierarchyConf, splitter),
                data
            };
        });

        const trie = Hierarchy.build(rawSpecs);
        const aggressive = pathCompression === 'on-aggressive';

        Hierarchy.walk(trie, (node) => {
            if (!Hierarchy.Node.isData(node)) {
                return;
            }
            const data = Hierarchy.Node.getData(node);
            specs.push({
                path: buildCompressedPath(node, aggressive),
                data
            });
        });
    }

    return specs;
}




/** Формирует массив сегментов пути для одного элемента.
 *
 * ### `group.kind` добавляется первым сегментом:
 *
 * Когда включена опция `useGroupKind`, элементы группируются по семантическому
 * признаку (`group.kind`), а не только по синтаксическому разбиению имени.
 *
 * ### Общий `Splitter`:
 *
 * `Splitter` централизует логику разбиения строк по разделителю и кеширует
 * результаты.
 *
 * @param path   Полное имя элемента (seg:ment:s:label).
 * @param data   Данные узла, из которых извлекается `group.kind`.
 * @param conf Конфигурация иерархии (влияет на группировку).
 * @param splitter Экземпляр {@linkcode Splitter}, уже настроенный нужным разделителем.
 * @returns Массив сегментов пути (всегда содержит хотя бы один элемент).
 *  */
function buildPath(
    segments: Readonly<[name: string, groupKind: TaskGroup | null]>,
    conf: Readonly<HierarchyConf>,
    splitter: Splitter
): ReadonlyArray<string> {

    const group = segments.at(1) as TaskGroup | undefined | null;
    if (conf.useGroupKind && group) {
        return [group.kind, ...splitter.split(segments.at(0)! as string)];
    }

    return splitter.split(segments.at(0)! as string);
}


/** Строит сжатый путь от листа (data-узла) к корню иерархии.
 *
 * Обход снизу вверх по `parent`-цепочке. Линейные участки (узлы с одним ребёнком)
 * накапливаются в `chain` и склеиваются через *разделитель* при встрече *branch point* —
 * сбрасываются в `compressed` как один сегмент, после чего `chain` очищается.
 * По завершении обхода — финальный flush остатка `chain`,
 * затем `compressed` разворачивается (заполнялся от листа к корню).
 *
 * **Различие режимов** (`aggressive`):
 * - **`false` (normal)** — сегмент самого листа в сжатие не входит, добавляется
 *   отдельным несжатым сегментом в конец результата.
 * - **`true` (aggressive)** — сегмент листа участвует в `chain` с самого начала;
 *   дополнительно: runnable-узел (data) с ≥1 ребёнком трактуется как
 *   forced branch point наравне с обычными узлами с >1 ребёнком.
 *
 * **Пример (normal).** Путь `root → a → b → c → d → leaf`, `b` — branch point:
 * - подъём от `d`: chain = `[d, c]` → flush при `b` → compressed = `["c › d"]`
 * - продолжение: chain = `[b, a]` → финальный flush → compressed = `["c › d", "a › b"]`
 * - reverse → `["a › b", "c › d"]`
 * - push листа → `["a › b", "c › d", "leaf"]`
 *
 * @resolved Пустой `chain` при flush: если data-узел — непосредственный потомок
 * branch point, `chain` пуст в момент flush. Раньше это давало фантомный пустой
 * сегмент (`[].join(...)` === `''`). Исправлено проверкой `chain.length > 0`.
 *
 * @param dataNode Лист — data-узел иерархии, для которого строится путь.
 * @param aggressive Режим сжатия. См. описание выше.
 * @returns Массив сжатых сегментов от корня к листу. При `aggressive = false` последним
 *   элементом идёт несжатый сегмент листа; при `true` лист уже включён в сжатие. */
function buildCompressedPath(
    dataNode: Readonly<Hierarchy.Data<NodeData>>,
    aggressive: boolean  // true = 'on-aggressive', false = 'on'
): ReadonlyArray<string> {

    // @note Смотри sketches/10.02-pinned-smart-subsegment.jsonc
    // Для проверки поведения в SMART режиме.

    const chain: string[] = [];
    const compressed: string[] = [];

    // Стартуем от листа, поднимаемся к scope

    // (switch) - SMART режим path compression
    if (aggressive) {
        chain.push(Hierarchy.Node.getSegment(dataNode));
    }

    let parent = Hierarchy.Node.getParent(dataNode);

    // подъем к root`у по цепочке parent
    while (parent) {

        const isDataParent = Hierarchy.Node.isData(parent);

        // SMART: data-родитель — forced branch (flush + уходит в chain к предкам)
        const isForcedBranch =
            (aggressive && isDataParent)
            || Hierarchy.Node.hasMultipleChildren(parent); // имеет больше одного дочернего узла

        // NORMAL: data-родитель — разрыв цепочки (flush + идёт в compressed как отдельный сегмент)
        const isNormalDataBreak =
            !aggressive && isDataParent;

        if (isForcedBranch || isNormalDataBreak) {
            if (chain.length > 0) {
                chain.reverse();
                compressed.push(chain.join(DISPLAY_ITEM_SEPARATOR));
                chain.length = 0;
            }
        }

        if (isNormalDataBreak) {
            // data-родитель становится законченным сегментом — не сжимается с предками
            compressed.push(Hierarchy.Node.getSegment(parent));
            parent = Hierarchy.Node.getParent(parent);
            continue;
        }

        chain.push(Hierarchy.Node.getSegment(parent));
        parent = Hierarchy.Node.getParent(parent);
    }

    // Финальный flush — оставшиеся сегменты у корня
    if (chain.length > 0) {
        chain.reverse();
        compressed.push(chain.join(DISPLAY_ITEM_SEPARATOR));
        // compressed заполняется от листа к корню (flush при подъёме),
        // reverse приводит к порядку от корня к листу.
        compressed.reverse();
    }

    // (switch) - Нормальный режим path compression
    if (!aggressive) {
        compressed.push(Hierarchy.Node.getSegment(dataNode));
    }

    return compressed;
}


export default createSpecs;
