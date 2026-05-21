/** @file TreeModel/NodeSpec.ts */
/** @module NodeSpec */


import { DisplayItemSeparator } from '../constants';
import Hierarchy from './Hierarchy';
import Splitter from './Splitter';


/** Спецификация узла: путь (сегменты) и данные. */
interface NodeSpec<D extends NodeSpec.NodeData> {
    readonly path: ReadonlyArray<string>;
    readonly data: D;
}


declare namespace NodeSpec {

    export interface NodeData {
        readonly [key: string]: unknown;
        readonly group?: { kind: string; } | null;
    }

    export interface HierarchyConfig {
        /** Включает группировку первого уровня по свойству `group.kind`. */
        readonly useGroupKind: boolean;
        /** Разделитель сегментов в пути (например `:` для `build:dev:watch`). */
        readonly segmentSeparator: string;
    }

    export type CompressionBehavior = 'off' | 'on' | 'on-aggressive';

}


const NodeSpec = {

    /** Преобразует индекс определений узлов в индекс спецификаций для построения иерархии.
     *
     * ### Режимы компрессии путей
     *
     * При `compression === 'off'` пути строятся напрямую через {@linkcode buildPath}.
     *
     * При `'on'` и `'on-aggressive'`: все элементы
     * участвуют в построении временного trie, после чего пути сжимаются через
     * {@linkcode buildCompressedPath}. Линейные участки склеиваются в один сегмент;
     * `'on-aggressive'` дополнительно трактует runnable-узлы как точки разреза.
     *
     * @returns Индекс спецификаций: по одной записи {@linkcode SpecEntry} на каждый ключ входного индекса.
     * */
    createSpecs<D extends NodeSpec.NodeData>({
        nodeDataItems,
        hierarchyConfig,
        compression
    }: {
        nodeDataItems: ReadonlyArray<Readonly<[name: string, data: D]>>;
        hierarchyConfig: Readonly<NodeSpec.HierarchyConfig>;
        compression: NodeSpec.CompressionBehavior;
    }): Readonly<ReadonlyArray<Readonly<NodeSpec<D>>>> {

        const specs: NodeSpec<D>[] = [];

        const { segmentSeparator } = hierarchyConfig;
        const splitter = Splitter.create(segmentSeparator);

        if (compression === 'off') {

            for (const [name, data] of nodeDataItems) {

                specs.push({
                    path: buildPath(splitter.split(name), data, hierarchyConfig),
                    data
                });
            }
        }
        else {

            const rawSpecs = nodeDataItems.map(([name, data]) => ({
                path: buildPath(splitter.split(name), data, hierarchyConfig),
                data
            }));

            const trie = Hierarchy.build(rawSpecs);
            const aggressive = compression === 'on-aggressive';

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

} as const;


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
 * @param config Конфигурация иерархии (влияет на группировку).
 * @param splitter Экземпляр {@linkcode Splitter}, уже настроенный нужным разделителем.
 * @returns Массив сегментов пути (всегда содержит хотя бы один элемент).
 *  */
function buildPath(
    segments: ReadonlyArray<string>,
    data: Readonly<NodeSpec.NodeData>,
    config: Readonly<NodeSpec.HierarchyConfig>
): ReadonlyArray<string> {

    const groupKind = data.group?.kind;

    if (config.useGroupKind && groupKind) {
        return [groupKind, ...segments];
    }

    return segments;
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
function buildCompressedPath<D extends NodeSpec.NodeData>(
    dataNode: Readonly<Hierarchy.Data<D>>,
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
                compressed.push(chain.join(DisplayItemSeparator));
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
        compressed.push(chain.join(DisplayItemSeparator));
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


export default NodeSpec;
