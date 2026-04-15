/** @file Cockpit/Tree/Section.ts */
/** @module Section */

import * as TC from '../../types';
import Hierarchy from './Hierarchy';
import Splitter from './Splitter';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


/** Детализация количества задач в scope. */
interface TaskCounts {
    /** Общее количество задач. */
    totalCount: number;
    /** Количество скрытых задач (с `hide: true`). */
    hiddenCount: number;
}


interface FolderCounts {

    totalCount: number;

    hiddenCount: number;
}


declare namespace Section {

    /** Элемент дерева секции — запускаемая задача, и/или группирующий узел. */
    // export type Item = Readonly<Item.Runnable | Item.Group>;
    export type Item = Readonly<Hierarchy.Data<TC.TaskDefinition> | Hierarchy.Branch<TC.TaskDefinition>>;


    /** Секция избранных задач. (Всегда первая в массиве секций) */
    type PinnedBase = {
        /** Фиксированное имя секции. */
        name: 'Pinned';

        kind: TC.EntityKind.PinnedSingle | TC.EntityKind.PinnedMulti | TC.EntityKind.PinnedStaleOnly;
        /** Ссылки на избранные задачи, определения которых не найдены
         * в текущем {@linkcode TC.DefinitionsByFile | definitionMap}.
         * Отображаются в начале секции как "сломанные". */
        stales: ReadonlyArray<Readonly<TC.PinnedStale>>;
        /** Файл задач — присутствует только в single-root workspace.
         * В multi-root дочерние {@linkcode Source} содержат свои `tasksFile`. */
        tasksFile?: TC.File;
        /** Дочерние элементы.
         * - Single-root ({@linkcode PinnedSingle}): {@linkcode Item Item[]} — узлы иерархии.
         * - Multi-root ({@linkcode PinnedMulti}): {@linkcode PinnedFolder FolderF[]} — обёртки по workspace folders.
         * - undefined — специальный случай: есть только битые задачи */
        children?: ReadonlyArray<Item | PinnedFolder>;
    };

    export interface PinnedSingle extends PinnedBase {
        kind: TC.EntityKind.PinnedSingle;
        tasksFile: TC.File;
        children: ReadonlyArray<Item>;
        nodeConfig: TC.NodeConfig;
    }

    export interface PinnedMulti extends PinnedBase {
        kind: TC.EntityKind.PinnedMulti;
        tasksFile?: undefined;
        children: ReadonlyArray<PinnedFolder>;
    }

    export interface PinnedEmpty extends PinnedBase {
        kind: TC.EntityKind.PinnedStaleOnly;
        tasksFile?: undefined;
        children?: undefined;
    }

    type Pinned = PinnedSingle | PinnedMulti | PinnedEmpty;

    /** Секция файла задач — задачи одного `.vscode/tasks.json` или `.code-workspace`. */
    export interface Source {
        /** Тип секции. Определяется по расширению файла:
         * `.json` → {@linkcode TC.EntityKind.Folder}, иначе → {@linkcode TC.EntityKind.Workspace}. */
        kind: TC.EntityKind.Workspace | TC.EntityKind.Folder;
        /** Имя workspace folder (display name). */
        folderName: TC.FolderName;
        /** Абсолютный путь к файлу задач (`fsPath`). */
        tasksFile: TC.File;
        /** Элементы дерева — результат построения иерархии для данного scope. */
        children: ReadonlyArray<Item>;
        /** Статистика задач в файле. Присутствует только у файловых секций
         * (не у Pinned-обёрток в multi-root). */
        taskCounts: TaskCounts;
        nodeConfig: TC.NodeConfig;
    }

    /** Папка-обёртка внутри Pinned */
    export type PinnedFolder = Omit<Source, 'kind' | 'taskCounts'> & {
        kind: TC.EntityKind.PinnedFolder;
    };

}


/** Модуль строит промежуточную модель дерева задач (Секции) из сырых определений.
 *
 * Два типа секций:
 * - **Pinned** — избранные задачи со всех scope, с сжиманием путей для компактности.
 * - **File** — задачи одного файла (`.vscode/tasks.json` или `.code-workspace`).
 * 
 * @todo поведение, реакция на конфигурации...
 * 
 * Фильтрация по hidden происходит в модели, а не в представлении, поскольку
 * представление не должно показывать цепочку пустых сегментов. Но понять
 * что цепочка пуста оно сможет понять только достроив ветку до листа
 * и проверив его поле hidden.
 * 
 * Цепочка обработки:
 * 1. Определения фильтруются (hidden) и трансформируются в {@link Hierarchy.Spec} —
 *    линейное преобразование label → path через {@link Splitter} и опциональный `group.kind`.
 * 1. Спецификации передаются в {@link Hierarchy.build}, который строит trie.
 * 1. Результат разворачивается в массив секций: `[Pinned, ...File[]]`.
 *
 * Pinned проходят дополнительный этап: промежуточный trie строится для
 * path compression (склейка "пустых" участков через ` › `), после чего
 * сжатые спецификации передаются в финальный {@link Hierarchy.build}. */
const Section = {

    /** Строит полную модель дерева задач в виде массива секций.
     *
     * Два типа секций в результате:
     * - **Pinned** — единственная секция избранных задач (всегда первая, если присутствует).
     *   Тип зависит от workspace: {@linkcode Section.PinnedSingle} в single-root,
     *   {@linkcode Section.PinnedMulti} в multi-root (задачи сгруппированы по папкам),
     *   {@linkcode Section.PinnedEmpty} если есть только битые ссылки.
     *   Отсутствует при `visibility === TC.PinnedVisibility.HIDE` или если нет
     *   ни valid pinned-задач, ни stale-ссылок.
     *   **Исключённые папки на Pinned не влияют** — закреплённые задачи из них
     *   всё равно отображаются.
     * - **Source** — по одной секции на каждый не-исключённый scope,
     *   в порядке `treeInput.scopeIndex`.
     *
     * @param treeInput Входные данные: scope-индекс, конфигурация Pinned, исключённые папки.
     * @returns
     *   - `sections` — `[Pinned?, ...Source[]]`.
     *   - `folderCounts` — `totalCount`: количество всех папок workspace (включая исключённые);
     *     `hiddenCount`: количество исключённых (`excludedFolders`). */
    buildSections(
        treeInput: TC.DeepReadonly<TC.TreeInput>
    ): {
        sections: Array<Section.Pinned | Section.Source>;
        folderCounts: FolderCounts;
    } {

        const folderCounts = { totalCount: 0, hiddenCount: 0 };

        if (treeInput.scopeIndex.size < 1) {
            return { sections: [], folderCounts };
        }

        const pinnedSpecs = new Map<TC.File, TC.DeepReadonly<{
            folderName: TC.FolderName;
            nodeConfig: TC.NodeConfig;
            specs: ReadonlyArray<Hierarchy.Spec<TC.TaskDefinition>>;
        }>>();


        const fileSpecs = new Map<TC.File, TC.DeepReadonly<{
            folderName: TC.FolderName;
            specs: Array<Hierarchy.Spec<TC.TaskDefinition>>;
            taskCounts: TaskCounts;
            nodeConfig: TC.NodeConfig;
        }>>();

        const pinnedVisible = treeInput.pinnedConfig.visibility !== TC.PinnedVisibility.HIDE;

        // обход всех областей
        for (const [scopeFile, scopeRecord] of treeInput.scopeIndex) {

            folderCounts.totalCount++;

            // если папка не скрыта
            if (!scopeRecord.excluded) {
                // получение спецификаций области
                fileSpecs.set(
                    scopeFile,
                    {
                        folderName: scopeRecord.folderName,
                        nodeConfig: scopeRecord.nodeConfig,
                        ...makeFileSpecs(scopeRecord)
                    }
                );
            }
            else {
                folderCounts.hiddenCount++;
            }

            // если секция "закрепленные" не скрыта...
            if (pinnedVisible) {
                // если область имеет закрепленные задачи...
                // получение спецификаций закрепленных для области
                if (scopeRecord.pinned.size > 0) {
                    pinnedSpecs.set(scopeFile,
                        {
                            folderName: scopeRecord.folderName,
                            nodeConfig: scopeRecord.nodeConfig,
                            specs: makePinnedSpecs(scopeRecord, treeInput.pinnedConfig.compressionBehavior)
                        }
                    );
                }
            }

        }

        const sections: (Section.Pinned | Section.Source)[] = [];

        const pinnedSection = buildPinnedSection(
            pinnedSpecs,
            treeInput.pinnedConfig.staleRecords,
            treeInput.scopeIndex.size > 1
        );

        if (pinnedSection) {
            sections.push(pinnedSection);
        }

        for (const [tasksFile, { folderName, specs, taskCounts, nodeConfig }] of fileSpecs) {

            sections.push({
                kind: tasksFile.endsWith('.json') ? TC.EntityKind.Folder : TC.EntityKind.Workspace,
                folderName,
                tasksFile,
                children: Hierarchy.getRoots(Hierarchy.build(specs)),
                taskCounts,
                nodeConfig
            });
        }

        return { sections, folderCounts };
    },


    /** Type guards для элементов дерева секции. */
    Child: {

        /** Проверяет, является ли элемент группирующим узлом (имеет детей). */
        isGroup(child: Section.Item): boolean { //child is Section.Item.Group {
            return Hierarchy.Node.isBranch(child);
        },

        /** Проверяет, является ли элемент задачей (data-узел). */
        isRunnable(child: Section.Item): boolean { //child is Section.Item.Runnable {
            return Hierarchy.Node.isData(child);
        }

    } as const,

} as const;



/** Собирает секцию Pinned из готовых спецификаций по всем scope.
 *
 * Четыре возможных результата в зависимости от входов:
 *
 * - `null` — нет ни одной valid pinned-задачи и нет `stales`.
 *   Секция Pinned в дереве отсутствует.
 * - {@linkcode Section.PinnedEmpty} (`kind: PinnedStaleOnly`) — valid pinned нет,
 *   но есть `stales`. Секция отображается только сломанными ссылками.
 * - {@linkcode Section.PinnedSingle} — `isMultiRoot === false`, ровно один scope.
 *   Плоская секция: `children` — узлы иерархии напрямую, `tasksFile` указывает
 *   на единственный файл задач.
 * - {@linkcode Section.PinnedMulti} — `isMultiRoot === true`. Каждый scope
 *   оборачивается в {@linkcode Section.PinnedFolder}; порядок обёрток совпадает
 *   с порядком итерации `pinnedSpecs` (= порядок workspace folders).
 *
 * Поле `stales` прокидывается в результат во **всех** не-`null` ветках,
 * не только в `PinnedStaleOnly` — сломанные ссылки показываются и при наличии
 * valid задач.
 *
 * Алгоритм построения иерархии (per-scope, для `PinnedSingle` и каждой обёртки
 * в `PinnedMulti`):
 * 1. Готовые спецификации передаются в {@linkcode Hierarchy.build} —
 *    строится trie со scope = `folderName`.
 * 1. {@linkcode Hierarchy.getRoots} извлекает дочерние узлы scope-корня —
 *    они и становятся `children`.
 *
 * Спецификации со сжатыми путями строятся вызывающей стороной через
 * {@linkcode makePinnedSpecs}; здесь они уже готовы к финальному build.
 *
 * @param pinnedSpecs Карта `tasksFile → { folderName, specs }` — по одной записи
 *   на каждый scope, где есть хотя бы одна valid pinned-задача.
 * @param stales Сломанные pinned-ссылки (определения не найдены в `definitionMap`).
 *   Прокидываются в результат как есть.
 * @param isMultiRoot Флаг multi-root workspace. Определяет форму результата
 *   (`PinnedMulti` vs `PinnedSingle`); должен быть согласован с `pinnedSpecs.size`.
 * @returns Секция Pinned одного из четырёх вариантов выше, либо `null`. */
function buildPinnedSection(
    pinnedSpecs: TC.DeepReadonly<
        Map<TC.File, {
            folderName: TC.FolderName,
            specs: ReadonlyArray<Hierarchy.Spec<TC.TaskDefinition>>;
            nodeConfig: TC.NodeConfig;
        }>
    >,
    stales: TC.DeepReadonly<
        Array<TC.PinnedStale>
    >,
    isMultiRoot: boolean
): Section.Pinned | null {

    if (pinnedSpecs.size < 1) {
        if (stales.length > 0) {
            // stale-only: нет ни одного valid pinned ни в одном scope
            return {
                kind: TC.EntityKind.PinnedStaleOnly,
                name: 'Pinned',
                stales,
            };
        }
        // вообще ничего нет
        return null;
    }

    if (isMultiRoot) {

        const children: Section.PinnedFolder[] = [];

        for (const [tasksFile, { folderName, specs, nodeConfig }] of pinnedSpecs) {
            children.push({
                kind: TC.EntityKind.PinnedFolder,
                folderName,
                tasksFile,
                nodeConfig,
                children: Hierarchy.getRoots(Hierarchy.build(specs))
            });
        }

        return {
            kind: TC.EntityKind.PinnedMulti,
            name: 'Pinned',
            stales,
            children,
        };

    }

    if (pinnedSpecs.size !== 1) {
        // single-root: ожидается ровно один scope
        throw new Error(`Internal error: expected pinnedSpecs.size === 1 for single-root, got ${pinnedSpecs.size}`);
    }

    const [tasksFile, { specs, nodeConfig }] = pinnedSpecs.entries().next().value!;
    return {
        kind: TC.EntityKind.PinnedSingle,
        name: 'Pinned',
        stales,
        children: Hierarchy.getRoots(Hierarchy.build(specs)),
        tasksFile,
        nodeConfig
    };

}


/** Строит массив спецификаций для одной файловой (не Pinned) секции.
 *
 * Принимает файловый scope и соответствующую ему запись с конфигурацией
 * дерева и картой определений задач.
 *
 * 1. Извлекает конфигурацию дерева (`useGroupKind`, `segmentSeparator`, `showHidden`).
 * 1. Создаёт {@linkcode Splitter} для разбиения label по сепаратору.
 * 1. Итерирует {@linkcode TC.ScopeIndex.definitionMap}:
 *      - Скрытые задачи (`hidden: true`) пропускаются при `showHidden === false`;
 *        при этом `hiddenCount` увеличивается.
 *      - Для остальных строится `path` через {@linkcode toPathSegments}.
 *
 * Scope спецификации — `fsPath` файла (в отличие от Pinned, где scope = folderName).
 *
 * @returns Спецификации для {@linkcode Hierarchy.build} и счётчики задач scope'а. */
function makeFileSpecs(
    scopeRecord: TC.DeepReadonly<TC.ScopeRecord>
): {
    specs: Array<
        Hierarchy.Spec<TC.TaskDefinition>
    >;
    taskCounts: TaskCounts;
} {

    if (scopeRecord.definitionMap.size < 1) {
        return {
            // name: scopeRecord.name,
            specs: [],
            taskCounts: {
                totalCount: 0,
                hiddenCount: 0
            }
        };
    }

    const { useGroupKind, segmentSeparator, showHidden } = scopeRecord.treeConfig;

    const splitter = new Splitter(segmentSeparator);

    // счетчики TaskCounts
    let totalCount = 0;
    let hiddenCount = 0;

    const specs: Hierarchy.Spec<TC.TaskDefinition>[] = [];

    for (const [name, taskDefinition] of scopeRecord.definitionMap) {

        totalCount++;

        // Если taskDefinition помечена как hidden — ее ветку полностью исключаем
        // из структуры. Это приходится делать здесь поскольку вювер не должен
        // показывать пустые папки, но понять что папка пуста не сможет
        // не проверив ее на всю глубину.
        if (!showHidden && taskDefinition.hidden) {
            // Собирать информацию только о реально скрываемых задачах
            hiddenCount++;
            continue;
        }

        specs.push({
            // Если `useGroupKind === true`, и у задачи есть группа, то
            // то первым сегментом будет название группы. Это поведение не зависит от
            // значения `segmentSeparator`.
            // Остальные сегменты получаются разбиванием `name` по `segmentSeparator`.
            // See: {@linkcode Splitter}.
            // Линейная трансформация: для каждого определения строится path —
            // опционально group.kind первым сегментом, затем splitter.split(name).
            path: toPathSegments(name, taskDefinition.group?.kind, useGroupKind, splitter),
            data: taskDefinition
        });
    }

    return {
        specs,
        taskCounts: { totalCount, hiddenCount }
    };
}


/** Строит массив сегментов пути для {@linkcode Hierarchy.Spec}.
 *
 * Если `useGroupKind === true` и `groupKind` определён —
 * название группы становится первым сегментом, за которым следуют
 * сегменты из {@linkcode Splitter.split | splitter.split(label)}.
 *
 * Если группировка отключена или группа отсутствует — путь состоит
 * только из сегментов label.
 *
 * @param label Полный label задачи (например `"build:dev:watch"`).
 * @param groupKind Значение `group.kind` из определения задачи (например `"build"`).
 * @param useGroupKind Флаг включения группировки по `group.kind`.
 * @param splitter Экземпляр {@linkcode Splitter} с настроенным сепаратором.
 * @returns Массив сегментов пути — никогда не пуст (Splitter гарантирует ≥1 сегмент). */
function toPathSegments(
    label: string,
    groupKind: TC.Group | undefined,
    useGroupKind: boolean,
    splitter: Splitter,
): ReadonlyArray<string> {
    return (useGroupKind && groupKind)
        ? [groupKind, ...splitter.split(label)]
        : splitter.split(label);
}


/** Строит спецификации для секции Pinned одного scope'а с *path compression*.
 *
 * Алгоритм в три этапа:
 *
 * 1. Построение pre-trie спецификаций:  
 *      Для каждого label из {@linkcode TC.ScopeRecord.pinned} находится определение задачи
 *      в {@linkcode TC.ScopeRecord.definitionMap} и строится path через {@linkcode toPathSegments}
 *      (с учётом конфигурации scope). Scope спецификации — `folderName` (не `fsPath`),
 *      т.к. в Pinned группировка по папкам.
 * 1. Промежуточный trie:  
 *      Спецификации передаются в {@linkcode Hierarchy.build} — строится *временное* дерево.
 *      Это дерево не используется напрямую; его единственное назначение —
 *      предоставить структуру для path compression на следующем этапе.
 * 1. Path compression через обход trie:  
 *      {@linkcode Hierarchy.walk} обходит все data-узлы временного trie.
 *      Для каждого data-узла {@linkcode buildCompressedPath} поднимается от листа к scope-корню:
 *      - **Линейные участки** (узлы с одним потомком) склеиваются через ` › `.
 *      - **Branch point** (узел с >1 потомком) — точка разреза: накопленные сегменты
 *        фиксируются как один сжатый сегмент.
 *
 * Результат — финальные спецификации с объединёнными путями, готовые для
 * повторного {@linkcode Hierarchy.build}.
 *
 * **Замечание:** Pinned игнорируют поле `hidden` — скрытые задачи
 * не фильтруются (в отличие от {@linkcode makeFileSpecs}).
 *
 * @param scopeRecord Запись scope'а с pinned-метками, картой определений и конфигурацией дерева.
 * @param compressionBehavior Параметры алгоритма сжатия путей.
 * @returns Сжатые спецификации для финального {@linkcode Hierarchy.build}. */
// @todo: (оптимизация "на потом"): path compression для Pinned за один проход.
//
// Сейчас используется двухпроходная схема:
//  1. preTrieSpecs → Hierarchy.build() → временный trie
//  2. Hierarchy.walk + buildCompressedPath (подъём от каждого data-узла)
//  3. сжатые пути → второй Hierarchy.build()
//
// Идея одного прохода:
// При построении иерархии сразу склеивать линейные single-child цепочки через ' › '.
//
// Нюанс (важный!):
//   Поскольку спецификации поступают в произвольном порядке (из pinned),
//   при онлайн-вставке будет возникать edge splitting: уже сжатое ребро может
//   потребовать разбиения, когда позже появится branch point или data-узел посередине.
//
//   Это не полный backtracking дерева, а локальные split'ы рёбер, поэтому выигрыш
//   всё равно остаётся, но код становится сложнее.
//
// Альтернативы:
//   - Сортировка путей + LCP (longest common prefix) между соседними — проще в реализации.
//   - Полноценный radix с поддержкой splitting.
//
// Практическая ценность:
//   Функция работает per-scope, т.е. обрабатывает pinned одной папки за раз.
//   Реалистичный размер датасета — единицы-десятки задач. При таком объёме
//   двухпроходная схема оправдана простотой. Оптимизация интересна алгоритмически,
//   но измеримого эффекта скорее всего не будет.
//
// Пока оставляем двухпроходный вариант — он достаточно быстрый и понятный.
function makePinnedSpecs(
    scopeRecord: TC.DeepReadonly<TC.ScopeRecord>,
    compressionBehavior: TC.CompressionBehavior
): ReadonlyArray<Hierarchy.Spec<TC.TaskDefinition>> {

    // #region DEBUG
    assert(scopeRecord.pinned.size > 0, 'Precondition: pinned is not empty');
    // #endregion DEBUG

    // `showHidden` игнорируется для pinned
    const { useGroupKind, segmentSeparator } = scopeRecord.treeConfig;

    const splitter = new Splitter(segmentSeparator);

    // --- Временный trie ---
    // Промежуточное дерево используется исключительно для path compression.
    // Тот же Hierarchy, что и для финального дерева, но со своим идентификатором 
    // области и назначением.
    const preTrieSpecs: Array<{
        scope: TC.FolderName;
        path: ReadonlyArray<string>;
        data: Readonly<TC.TaskDefinition>;
    }> = [];

    for (const label of scopeRecord.pinned) {

        const definition = scopeRecord.definitionMap.get(label);

        if (!definition) {
            // #region DEBUG
            throw new Error(`Precondition violated: pinned label "${label}" not found in definitionMap (scope: "${scopeRecord.folderName}")`);
            // #endregion DEBUG
            continue;
        }

        preTrieSpecs.push({
            scope: scopeRecord.folderName,
            path: toPathSegments(label, definition.group?.kind, useGroupKind, splitter),
            data: definition
        });
    }
    // Временный trie
    const tmpTrie = Hierarchy.build(preTrieSpecs);

    // --- Walk + path compression ---
    // Обход снизу вверх (от data-узла к scope-корню) по временному trie.
    // Линейные участки пути склеиваются.
    // Branch point (узел с >1 ребёнком) — точка разреза: накопленный chain
    // сбрасывается в compressed.
    // В итоге получаем спецификации с "ужатыми" путями.

    const pinnedSpecs: Hierarchy.Spec<TC.TaskDefinition>[] = [];

    Hierarchy.walk(tmpTrie, (node) => {

        if (!Hierarchy.Node.isData(node)) {
            return;
        }

        pinnedSpecs.push({
            path: buildCompressedPath(node, compressionBehavior),
            data: Hierarchy.Node.getData(node) // "извлечение"! 
            //> Если передавать напрямую (`data: node`) — BUG: {@linkcode Hierarchy.build}
            //> не затрет уже установленные структурные поля
        });
    });

    return pinnedSpecs;
}


/** Строит сжатый путь от листа (data-узла) к scope-корню для одной pinned-задачи.
 *
 * Обход снизу вверх по `parent`-цепочке. Линейные участки (узлы с одним ребёнком)
 * накапливаются в `chain` и склеиваются через ` › ` при встрече *branch point* —
 * сбрасываются в `compressed` как один сегмент, после чего `chain` очищается.
 * По завершении обхода — финальный flush остатка `chain`,
 * затем `compressed` разворачивается (заполнялся от листа к корню).
 *
 * **Различие режимов** ({@linkcode TC.CompressionBehavior}):
 * - **NORMAL** — сегмент самого листа в сжатие не входит, добавляется
 *   отдельным несжатым сегментом в конец результата.
 * - **SMART** — сегмент листа участвует в `chain` с самого начала;
 *   дополнительно: runnable-узел (data) с ≥1 ребёнком трактуется как
 *   forced branch point наравне с обычными узлами с >1 ребёнком.
 *
 * **Пример (NORMAL).** Путь `root → a → b → c → d → leaf`, `b` — branch point:
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
 * @param compressionBehavior Режим сжатия — `NORMAL` или `SMART`.
 *   См. {@linkcode TC.CompressionBehavior}.
 * @returns Массив сжатых сегментов от корня к листу. В `NORMAL` последним элементом
 *   идёт несжатый сегмент листа; в `SMART` лист уже включён в сжатие. */
function buildCompressedPath(
    dataNode: Readonly<Hierarchy.Data<TC.TaskDefinition>>,
    compressionBehavior: TC.CompressionBehavior
): ReadonlyArray<string> {

    // @note Смотри sketches/10.02-pinned-smart-subsegment.jsonc
    // Для проверки поведения в SMART режиме.

    const chain: string[] = [];
    const compressed: string[] = [];

    // Стартуем от листа, поднимаемся к scope

    // (switch) - SMART режим path compression
    if (compressionBehavior === TC.CompressionBehavior.SMART) {
        chain.push(Hierarchy.Node.getSegment(dataNode));
    }

    let parent = Hierarchy.Node.getParent(dataNode);

    const reverseAndJoin = () => {
        chain.reverse();
        compressed.push(chain.join('\u2009›\u2009'));
    };

    // подъем к root`у по цепочке parent
    while (parent) {

        const childrenCount = Hierarchy.Node.getBranchChildren(parent).length;

        let isForcedBranch = childrenCount > 1;

        // В SMART-режиме:
        // если узел runnable И имеет хотя бы одного ребёнка в pinned-дереве → считаем 
        // его forced branch point.
        if (compressionBehavior === TC.CompressionBehavior.SMART) {
            if (Hierarchy.Node.isData(parent) && (childrenCount > 0)) {
                isForcedBranch = true;
            }
        }

        if (isForcedBranch) {
            // @bug: `reverseAndJoin()` на пустом `chain` порождает
            // пустую строку в `compressed` (`[].join(...)` === `''`), которая
            // становится фантомным сегментом в итоговом path.
            // Воспроизводится(воспроизводилось) когда data-узел — непосредственный ребёнок
            // branch point (chain ещё пуст, т.к. обход стартует от листа
            // и branch point — первый же родитель).
            // @resolved: flush только при непустом chain.
            if (chain.length > 0) {
                reverseAndJoin();
                chain.length = 0;
            }
        }

        chain.push(Hierarchy.Node.getSegment(parent));
        parent = Hierarchy.Node.getParent(parent);
    }

    // Финальный flush — оставшиеся сегменты у корня
    if (chain.length > 0) {
        reverseAndJoin();
        // compressed заполняется от листа к корню (flush при подъёме),
        // reverse приводит к порядку от корня к листу.
        compressed.reverse();
    }

    // (switch) - Нормальный режим path compression
    if (compressionBehavior === TC.CompressionBehavior.NORMAL) {
        compressed.push(Hierarchy.Node.getSegment(dataNode));
    }

    return compressed;
}

export default Section;


