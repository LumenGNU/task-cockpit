/** @file Cockpit/Tree/Section.ts */
/** @module Section */

import * as TC from '../../types';
import Hierarchy from './Hierarchy';
import Splitter from './Splitter';

// #region DEBUG
import helpers from '../../helpers';
// #endregion DEBUG

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


/** Детализация количества задач в scope. */
interface TaskCounts {
    /** Общее количество задач. */
    total: number;
    /** Количество скрытых задач (с `hide: true`). */
    hidden: number;
}


/** Результат построения спецификаций для файловых секций. */
interface SpecsResult {
    /** Массив спецификаций, готовых к передаче в {@linkcode Hierarchy.build}. */
    specs: ReadonlyArray<Hierarchy.Spec<TC.TaskDefinition, TC.File>>;
    /** Детализация по каждому файлу задач. */
    taskCountsByFile: ReadonlyMap<TC.File, TaskCounts>;
}



declare namespace Section {

    /** Элемент дерева секции — запускаемая задача, и/или группирующий узел. */
    // export type Item = Readonly<Item.Runnable | Item.Group>;
    export type Item = Readonly<Hierarchy.Data<TC.TaskDefinition, TC.File> | Hierarchy.Branch<TC.TaskDefinition, TC.File>>;


    /** Секция избранных задач. (Всегда первая в массиве секций) */
    type FavoriteBase = {
        /** Фиксированное имя секции. */
        name: 'Pinned';

        kind: TC.EntityKind.PinnedSingle | TC.EntityKind.PinnedMulti;
        /** Ссылки на избранные задачи, определения которых не найдены
         * в текущем {@linkcode TC.DefinitionsByFile | definitionMap}.
         * Отображаются в начале секции как "сломанные". */
        stales: ReadonlyArray<Readonly<TC.PinnedStale>>;
        /** Файл задач — присутствует только в single-root workspace.
         * В multi-root дочерние {@linkcode Source} содержат свои `tasksFile`. */
        tasksFile?: TC.File;
        /** Дочерние элементы.
         * - Single-root ({@linkcode PinnedSingle}): {@linkcode Item Item[]} — узлы иерархии.
         * - Multi-root ({@linkcode PinnedMulti}): {@linkcode PinnedFolder FolderF[]} — обёртки по workspace folders. */
        children: ReadonlyArray<Item | PinnedFolder>;
    };

    export interface PinnedSingle extends FavoriteBase {
        kind: TC.EntityKind.PinnedSingle;
        tasksFile: TC.File;
        children: ReadonlyArray<Item>;
    }

    export interface PinnedMulti extends FavoriteBase {
        kind: TC.EntityKind.PinnedMulti;
        tasksFile?: undefined;
        children: ReadonlyArray<PinnedFolder>;
    }

    type Favorite = PinnedSingle | PinnedMulti;

    /** Секция файла задач — задачи одного `.vscode/tasks.json` или `.code-workspace`. */
    export interface Source {
        /** Тип секции. Определяется по расширению файла:
         * `.json` → {@linkcode TC.EntityKind.Folder}, иначе → {@linkcode TC.EntityKind.Workspace}. */
        kind: TC.EntityKind.Workspace | TC.EntityKind.Folder;
        /** Имя workspace folder (display name). */
        name: TC.FolderName;
        /** Абсолютный путь к файлу задач (`fsPath`). */
        tasksFile: TC.File;
        /** Элементы дерева — результат построения иерархии для данного scope. */
        children: ReadonlyArray<Item>;
        /** Статистика задач в файле. Присутствует только у файловых секций
         * (не у Favorite-обёрток в multi-root). */
        taskCounts: TaskCounts;
    }

    /** Папка-обёртка внутри Pinned */
    export type PinnedFolder = Omit<Source, 'kind' | 'taskCounts'> & {
        kind: TC.EntityKind.PinnedFolder;
    };

}


/** Модуль строит промежуточную модель дерева задач (Секции) из сырых определений.
 *
 * Два типа секций:
 * - **Favorite** — избранные задачи со всех scope, с сжиманием путей для компактности.
 * - **File** — задачи одного файла (`.vscode/tasks.json` или `.code-workspace`).
 *
 * Цепочка обработки:
 * 1. Определения фильтруются (hidden) и трансформируются в {@link Hierarchy.Spec} —
 *    линейное преобразование label → path через {@link Splitter} и опциональный `group.kind`.
 * 1. Спецификации передаются в {@link Hierarchy.build}, который строит trie.
 * 1. Результат разворачивается в массив секций: `[Favorite, ...File[]]`.
 * 
 * Фильтрация по hidden происходит в модели, а не в представлении, поскольку
 * представление не должно показывать цепочку пустых сегментов. Но понять
 * что цепочка пуста оно сможет понять только достроив ветку до листа
 * и проверив его поле hidden.
 *
 * Pinned проходят дополнительный этап: промежуточный trie строится для
 * path compression (склейка "пустых" участков через ` › `), после чего
 * сжатые спецификации передаются в финальный {@link Hierarchy.build}. */
const Section = {

    /** Строит полную модель дерева: секция Pinned + по одной File секции на scope.
     *
     * Алгоритм:
     * 1. Строит секцию Pinned (см. {@linkcode buildPinnedSection}).
     * 1. Собирает спецификации из определений задач (см. {@linkcode makeFileSpecs}):
     *      - Фильтрация hidden-задач.
     *      - Трансформация label → path (см. {@linkcode toPathSegments}).
     *      - Подсчёт {@linkcode TaskCounts} по файлам.
     * 1. Передаёт спецификации в {@linkcode Hierarchy.build} — единый trie для всех scope.
     * 1. Извлекает дочерние узлы каждого scope из trie и оборачивает в {@linkcode Section.Source}.
     *
     * @param scopes Список workspace-scope (порядок определяет порядок секций).
     * @param favoritesConfig Конфигурация избранных: записи и устаревшие ссылки.
     * @param definitionMap Определения задач, сгруппированные по файлу (`fsPath` → Map<label, def>).
     * @param treeConfigMap Конфигурация отображения дерева по файлу (`fsPath` → config).
     * @returns Кортеж `[Favorite, ...File[]]` — Pinned всегда первый элемент. */
    buildEntities(
        scopes: ReadonlyArray<TC.Scope>,
        favoritesConfig: Readonly<TC.PinnedConfig>,
        definitionMap: Readonly<TC.DefinitionsByFile>,
        treeConfigMap: Readonly<TC.TreeConfigByFile>,
    ): readonly [Section.Favorite, ...Section.Source[]] {

        const sections: [Section.Favorite, ...Section.Source[]] = [
            buildPinnedSection(scopes, favoritesConfig, definitionMap, treeConfigMap)
        ];

        const { specs, taskCountsByFile } = makeFileSpecs(
            scopes,
            definitionMap,
            treeConfigMap
        );

        const hierarchy = Hierarchy.build(specs);

        for (const scope of scopes) {

            const file = scope.uri.fsPath;

            const hierarchyScope = Hierarchy.getScope(hierarchy, file);
            sections.push(
                makeSource(
                    scope.name,
                    file,
                    hierarchyScope ? Hierarchy.Scope.getChildren(hierarchyScope) : [],
                    taskCountsByFile.get(file)!
                )
            );
        }

        return sections;
    },

    // // #region DEBUG

    // /** ASCII представление дерева секции (отладка). */
    // printTree(section: Section.Favorite | Section.Source | Section.PinnedFolder, basePrefix?: string, formatter: (def: TC.TaskDefinition) => string = () => '(*)'): string {


    //     const lines: string[] = [`─ [${section.name}]`];

    //     if (section.kind === TC.EntityKind.PinnedSingle || section.kind === TC.EntityKind.PinnedMulti) {

    //         for (const stale of section.stales) {
    //             lines.push(`  ✗ ${stale.label} (${stale.scopeName})`);
    //         }

    //         if (section.kind === TC.EntityKind.PinnedMulti) {
    //             // Multi-root Pinned: children — FolderF[], рекурсия в каждую обёртку.
    //             for (const folder of section.children) {
    //                 lines.push(`  ${Section.printTree(folder, `    ${basePrefix ?? ''}`)}`);
    //             }
    //             return lines.join('\n');
    //         }
    //     }

    //     const tree = Hierarchy.Scope.printTree(section.children as ReadonlyArray<Section.Item>, formatter, basePrefix);
    //     if (tree) {
    //         lines.push(tree);
    //     }

    //     return lines.join('\n');
    // },

    // // #endregion DEBUG


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



/** Строит секцию Pinned.
 *
 * Поведение зависит от количества scope:
 *
 * **Single-root** (`scopes.length === 1`):
 * Плоская секция — `children` содержит узлы иерархии напрямую.
 * `tasksFile` указывает на единственный файл задач.
 *
 * **Multi-root** (`scopes.length > 1`):
 * Каждый scope оборачивается в {@linkcode Section.PinnedFolder} (FavoriteFolder-обёртка).
 * Порядок обёрток — по `scopes` (= порядок workspace folders).
 *
 * Алгоритм:
 * 1. Строит спецификации через {@linkcode makeFavoriteSpecs} (с path compression).
 * 1. Передаёт их в {@linkcode Hierarchy.build} — trie со scope = `folderName`.
 * 1. Извлекает дочерние узлы каждого scope и оборачивает в итоговую структуру. */
function buildPinnedSection(
    scopes: ReadonlyArray<TC.Scope>,
    favoritesConfig: Readonly<TC.PinnedConfig>,
    definitionMap: Readonly<TC.DefinitionsByFile>,
    treeConfigMap: Readonly<TC.TreeConfigByFile>,
): Section.Favorite {

    // Pinned hierarchy
    const { pinnedRecords: favoriteRecords, staleRecords, compressionBehavior } = favoritesConfig;

    const favoritesHierarchy = Hierarchy.build(
        makeFavoriteSpecs(favoriteRecords, compressionBehavior, definitionMap, treeConfigMap)
    );

    // Pinned section
    if (scopes.length > 1) {

        // Multi-root: каждый scope → FavoriteFolder-обёртка.
        // Порядок — по первому вхождению scope в favoriteRecords.

        const scopeByName = new Map(scopes.map(s => [s.name, s]));

        const seen = new Set<TC.FolderName>();
        const orderedNames: TC.FolderName[] = [];
        for (const ref of favoriteRecords) {
            if (!seen.has(ref.scope.name)) {
                seen.add(ref.scope.name);
                orderedNames.push(ref.scope.name);
            }
        }

        const fileChildren: Section.PinnedFolder[] = [];

        for (const name of orderedNames) {
            const scope = scopeByName.get(name)!;
            const folderScope = Hierarchy.getScope(favoritesHierarchy, name)!;
            // #region DEBUG
            assert(folderScope, `Pinned hierarchy: scope '${name}' not found`);
            // #endregion DEBUG
            fileChildren.push(
                makeFolderF(
                    name,
                    scope.uri.fsPath,
                    Hierarchy.Scope.getChildren(folderScope)
                )
            );
        }

        return makePinnedMulti(staleRecords, fileChildren);
    } else {

        // Single-root

        const favScopes = Hierarchy.getScopes(favoritesHierarchy);
        // #region DEBUG
        assert(favScopes.length <= 1, `Pinned hierarchy: expected ≤1 scope in single-root, got ${favScopes.length}`);
        // #endregion DEBUG

        return makePinnedSingle(
            staleRecords,
            favScopes.length > 0 ? Hierarchy.Scope.getChildren(favScopes[0]) : [],
            scopes[0].uri.fsPath);
    }
}


/** Фабрика объекта {@linkcode Section.PinnedSingle}.
 *
 * @param stales Ссылки на задачи, определения которых не найдены (stale/broken).
 * @param children Дочерние элементы секции.
 * @param tasksFile Файл задач (только для single-root). */
function makePinnedSingle(
    stales: ReadonlyArray<Readonly<TC.PinnedStale>>,
    children: ReadonlyArray<Section.Item>,
    tasksFile: TC.File
): Section.PinnedSingle {
    return {
        kind: TC.EntityKind.PinnedSingle,
        name: 'Pinned',
        stales,
        children,
        tasksFile
    };
}


function makePinnedMulti(
    stales: ReadonlyArray<Readonly<TC.PinnedStale>>,
    children: ReadonlyArray<Section.PinnedFolder>,
): Section.PinnedMulti {
    return {
        kind: TC.EntityKind.PinnedMulti,
        name: 'Pinned',
        stales,
        children,
    };
}


/** Фабрика объекта {@linkcode Section.Source}.
 *
 * Тип секции (`kind`) определяется эвристикой по расширению `tasksFile`:
 * - `.json` → {@linkcode TC.EntityKind.Folder} (`.vscode/tasks.json`).
 * - Иначе → {@linkcode TC.EntityKind.Workspace}.
 *
 * @param name Display name папки workspace.
 * @param tasksFile Абсолютный путь к файлу задач.
 * @param children Узлы иерархии данного scope.
 * @param taskCounts Статистика задач в файле. */
function makeSource(
    name: TC.FolderName,
    tasksFile: TC.File,
    children: ReadonlyArray<Section.Item>,
    taskCounts: TaskCounts
): Section.Source {
    return {
        kind: tasksFile.endsWith('.json') ? TC.EntityKind.Folder : TC.EntityKind.Workspace,
        name,
        tasksFile,
        children,
        taskCounts
    };
}

function makeFolderF(
    name: TC.FolderName,
    tasksFile: TC.File,
    children: ReadonlyArray<Section.Item>,
): Section.PinnedFolder {
    return {
        kind: TC.EntityKind.PinnedFolder,
        name,
        tasksFile,
        children
    };
}


/** Строит массив спецификаций для файловых (не Pinned) секций.
 *
 * Для каждого scope:
 * 1. Извлекает конфигурацию дерева (`useGroupKind`, `segmentSeparator`, `showHidden`).
 * 1. Создаёт {@linkcode Splitter} для разбиения label по сепаратору.
 * 1. Итерирует определения задач:
 *      - Скрытые задачи (`hidden: true`) пропускаются при `showHidden === false`.
 *      - Для остальных строится `path` через {@linkcode toPathSegments}.
 * 1. Ведёт подсчёт {@linkcode TaskCounts} (total / hidden) по каждому файлу.
 *
 * Scope спецификации — `fsPath` файла (в отличие от Pinned, где scope = folderName).
 *
 * @returns Спецификации для {@linkcode Hierarchy.build} и статистику по файлам. */
function makeFileSpecs(
    scopes: ReadonlyArray<Readonly<TC.Scope>>,
    definitionMap: Readonly<TC.DefinitionsByFile>,
    treeConfigMap: Readonly<TC.TreeConfigByFile>,
): Readonly<SpecsResult> {

    const specs: Hierarchy.Spec<TC.TaskDefinition, TC.File>[] = [];

    const taskCountsByFile = new Map<TC.File, TaskCounts>();


    for (const scope of scopes) {

        // Линейная трансформация: для каждого определения строится path —
        // опционально group.kind первым сегментом, затем splitter.split(name).
        // Конфиг (segmentSeparator, useGroupKind) берётся из configMap по файлу.

        const file = scope.uri.fsPath;

        const { useGroupKind, segmentSeparator, showHidden } = treeConfigMap.get(file)!;

        const splitter = new Splitter(segmentSeparator);

        const definitions = definitionMap.get(file)!;

        // счетчики TaskCounts
        let total = 0;
        let hiddenCount = 0;

        for (const [name, taskDefinition] of definitions) {

            total++;

            // Если taskDefinition помечена как hidden — ее ветку полностью исключаем
            // из структуры. Это приходится делать здесь поскольку вювер не должен
            // показывать пустые папки
            if (!showHidden && taskDefinition.hidden) {
                // Собирать информацию только о реально скрываемых задачах
                hiddenCount++;
                continue;
            }

            specs.push({
                scope: file,
                // Если `useGroupKind === true`, и у задачи есть группа, то
                // то первым сегментом будет название группы. Это поведение не зависит от
                // значения `segmentSeparator`.
                // Остальные сегменты получаются разбиванием `name` по `segmentSeparator`.
                // See: {@linkcode Splitter}
                path: toPathSegments(name, taskDefinition.group?.kind, useGroupKind, splitter),
                data: taskDefinition
            });
        }

        taskCountsByFile.set(file, { total, hidden: hiddenCount });
    }

    return { specs, taskCountsByFile };
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
): Array<string> {
    return (useGroupKind && groupKind)
        ? [groupKind, ...splitter.split(label)]
        : splitter.split(label);
}


/** Строит спецификации для секции Pinned с *path compression*.
 *
 * Алгоритм в три этапа:
 *
 * ### 1. Построение pre-trie спецификаций
 * Для каждой записи `favoriteRecords` находится определение задачи в `definitionMap`
 * и строится path через {@linkcode toPathSegments} (с учётом конфигурации scope).
 * Scope спецификации — `folderName` (не `fsPath`), т.к. в Pinned группировка по папкам.
 * {@linkcode Splitter} кешируется по `segmentSeparator` для повторного использования между scope.
 *
 * ### 2. Промежуточный trie
 * Спецификации передаются в {@linkcode Hierarchy.build} — строится *временное* дерево.
 * Это дерево не используется напрямую; его единственное назначение —
 * предоставить структуру для path compression на следующем этапе.
 *
 * ### 3. Path compression через обход trie
 * {@linkcode Hierarchy.walk} обходит все data-узлы временного trie.
 * Для каждого data-узла {@linkcode buildCompressedPath} поднимается от листа к scope-корню:
 * - **Линейные участки** (узлы с одним потомком) склеиваются через ` › `.
 * - **Branch point** (узел с >1 потомком) — точка разреза: накопленные сегменты
 *   фиксируются как один сжатый сегмент.
 *
 * Результат — финальные спецификации с объединенными путями, готовые для
 * повторного {@linkcode Hierarchy.build}.
 *
 * **Замечание:** Pinned игнорируют поле `hidden` — скрытые задачи
 * не фильтруются (в отличие от {@linkcode makeFileSpecs}).
 *
 * @param favoritesRefs Записи избранных из конфигурации.
 * @param definitionMap Определения задач по файлам.
 * @param treeConfigMap Конфигурация дерева по файлам.
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
//   Поскольку спецификации поступают в произвольном порядке (из favoritesConfig),
//   при онлайн-вставке будет возникать edge splitting: уже сжатое ребро может
//   потребовать разбиения, когда позже появится branch point или data-узел посередине.
//
//   Это не полный backtracking дерева, а локальные split'ы рёбер, поэтому выигрыш
//   всё равно остаётся (особенно при 50+ pinned-задачах), но код становится сложнее.
//
// Альтернативы:
//   - Сортировка путей + LCP (longest common prefix) между соседними — проще в реализации.
//   - Полноценный radix с поддержкой splitting.
//
// Преимущества:
//   - Полностью убираем временный trie и отдельный `walk`.
//   - Сложность падает с O(favorites × depth) → O(favorites × log(favorites) + Σ длины путей).
//   - Код `makeFavoriteSpecs` становится заметно короче и понятнее.
//   - Особенно выгодно при большом количестве pinned-задач (50–200+) с глубокой иерархией.
//
// Минусы / нюансы:
//   - Нужно аккуратно обрабатывать момент «разрыва» линейной цепочки.
//   - `printTree` и `resolvePath` придётся немного адаптировать под сжатые рёбра.
//   - Требует тщательного тестирования edge-кейсов (пустые пути, data-узел на branch point и т.д.).
// 
// Пока оставляем двухпроходный вариант — он достаточно быстрый и понятный.
function makeFavoriteSpecs(
    favoritesRefs: ReadonlyArray<Readonly<TC.FavoriteRef>>,
    compressionBehavior: TC.CompressionBehavior,
    definitionMap: Readonly<TC.DefinitionsByFile>,
    treeConfigMap: Readonly<TC.TreeConfigByFile>,
): ReadonlyArray<Hierarchy.Spec<TC.TaskDefinition, TC.FolderName>> {

    const splitterCache = new Map<string | false, Splitter>();

    const preTrieSpecs = [];

    for (const ref of favoritesRefs) {

        const definition =
            definitionMap
                .get(ref.scope.uri.fsPath)!
                .get(ref.label)!;

        const { useGroupKind, segmentSeparator } = treeConfigMap.get(ref.scope.uri.fsPath)!;

        let splitter = splitterCache.get(segmentSeparator);
        if (!splitter) {
            splitter = new Splitter(segmentSeparator);
            splitterCache.set(segmentSeparator, splitter);
        }

        preTrieSpecs.push({
            scope: ref.scope.name,
            path: toPathSegments(ref.label, definition.group?.kind, useGroupKind, splitter),
            data: definition
        });
    }

    // --- Временный trie ---
    // Промежуточное дерево используется исключительно для path compression.
    // Тот же Hierarchy, что и для финального дерева, но со своим идентификатором 
    // области и назначением.

    const tmpTrie = Hierarchy.build(preTrieSpecs);

    // --- Walk + path compression ---
    // Обход снизу вверх (от data-узла к scope-корню).
    // Линейные участки пути склеиваются.
    // Branch point (узел с >1 ребёнком) — точка разреза: накопленный chain
    // сбрасывается в compressed.

    const favoriteSpecs: Hierarchy.Spec<TC.TaskDefinition, TC.FolderName>[] = [];

    Hierarchy.walk(tmpTrie, (node) => {

        if (!Hierarchy.Node.isData(node)) {
            return;
        }

        const { originFolder, compressed } = buildCompressedPath(node, compressionBehavior);

        // (Pinned Scope игнорирует поле hidden).

        favoriteSpecs.push({
            scope: originFolder,// Область — синтетический идентификатор, имя каталога
            path: compressed,
            data: Hierarchy.Node.getData(node) // "извлечение"! 
            //> Если передавать напрямую (`data: node`) — BUG: {@linkcode Hierarchy.build}
            //> не затрет уже установленные структурные поля
        });
    });

    return favoriteSpecs;
}


/** Строит сжатый путь от data-узла к scope-корню (path compression для Pinned).
 *
 * Обход снизу вверх — от родителя `dataNode` до scope-корня.
 * Накапливает сегменты в `chain`. При встрече *branch point* (узел с >1 ребёнком):
 * - `chain` разворачивается (leaf→root → root→leaf) и склеивается через ` › `.
 * - Результат добавляется в `compressed` как один сегмент.
 * - `chain` очищается.
 *
 * По завершении обхода выполняется flush для `chain`,
 * а `compressed` разворачивается (т.к. заполнялся от листа к корню).
 *
 * **Пример:**
 * Путь `a → b → c → d → [leaf]`, где `b` — branch point (>1 ребёнок):
 * - Подъём от leaf: chain = `[d, c]` → flush при `b` → compressed = `["c › d"]`
 * - Продолжение: chain = `[b, a]` → финальный flush → compressed = `["c › d", "a › b"]`
 * - Reverse compressed → `["a › b", "c › d"]`
 *
 * @resolved Пустой `chain` при flush: если data-узел — непосредственный потомок
 * branch point, `chain` пуст на момент flush. Ранее это порождало фантомный
 * пустой сегмент (`[].join(...)` === `''`). Исправлено проверкой `chain.length > 0`.
 *
 * @param dataNode Лист — data-узел иерархии.
 * @returns `originFolder` — имя папки (scope id) и `compressed` — массив сжатых сегментов
 *   от корня к листу (без самого листа — он добавляется вызывающим кодом). */
function buildCompressedPath(
    dataNode: Readonly<Hierarchy.Data<TC.TaskDefinition, TC.FolderName>>,
    compressionBehavior: TC.CompressionBehavior
): {
    originFolder: TC.FolderName,
    compressed: string[];
} {

    // @note Смотри sketches/10.02-favorites-smart-subsegment.jsonc
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

    // подъем к scope по цепочке parent
    while (!Hierarchy.Node.isScope(parent)) {

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

    return { originFolder: Hierarchy.Scope.getScopeId(parent), compressed };
}

export default Section;


