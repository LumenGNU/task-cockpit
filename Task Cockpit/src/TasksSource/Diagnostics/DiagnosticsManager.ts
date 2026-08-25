/** @file TasksSource/Diagnostics/DiagnosticsManager.ts */

// Мотивация для DiagnosticsManager: ранняя диагностика коллизий меток задач
//
// Документ "task-shadowing.md" систематизирует неочевидное и местами противоречивое
// поведение VS Code при разрешении задач с одинаковыми метками (label) в разных
// источниках происхождения (User, Workspace, папки проекта).
// Ключевые выводы:
//
// - Прямой запуск задачи с коллизией:
//     Для первой папки (Primary Folder) и для задач из User/Workspace фактически выполняется
//     не та задача, которая выбрана в списке, а та, которая побеждает в порядке
//     User → Workspace → Primary Folder (Cross‑Origin Resolution Order).
//
//     Задачи из второй и последующих папок (folder2+) всегда выполняют свою локальную версию —
//     они изолированы.
//
// - Запуск через dependsOn:
//      Для всех источников, кроме первой папки, поиск зависимости строго ограничен тем
//      источником, где определена родительская задача (Strict Origin Resolution).
//      Отсутствие зависимости в этом источнике приводит к ошибке, даже если она есть в
//      других местах.
//
//      Первая папка (Primary Folder) использует каскадный поиск (Fallback Resolution):
//      сначала своя папка, затем Workspace, затем User. Она «наследует» зависимости
//      из более приоритетных источников.
//
// - Дубликаты внутри одного источника:
//      - При прямом запуске побеждает последнее определение в файле.
//      - При использовании как зависимости — первое определение.
//
// Эти правила создают «ловушки» для пользователя:
// - Пользователь может ожидать, что его задача из folder1 выполнится, но реально выполнится задача
//   из User с тем же именем.
// - Зависимость может не разрешиться, хотя задача с нужным именем "перед глазами".
// - Поведение различается в зависимости от того, запускается ли задача напрямую или через dependsOn.
// - Ошибки конфигурации проявляются только во время выполнения, часто неожиданно.
//
// Роль `DiagnosticsManager`: проактивное выявление описанных выше проблем ещё на этапе редактирования
// конфигураций задач.
// Он анализирует все источники задач (кроме User[^1]) и генерирует предупреждения непосредственно в
// редакторе, привязывая их к конкретным строкам JSON‑файлов.
//
// Какие проблемы ловит:
//
// - **duplicate-label**
//   Несколько определений с одинаковым label в одном файле-источнике.
//   Это приводит к неоднозначному выбору при запуске (последняя для прямого, первая для зависимостей).
//
// - **shadowed-label**
//   Метка задачи из некоторого источника «затенена» определением из другого источника с более высоким
//   приоритетом.
//
// - **missing-dependency**
//   Зависимость, объявленная через dependsOn, не может быть разрешена в том контексте, где определена
//   родительская задача.
//   Для источников Workspace и folder2+ это означает, что зависимость с таким именем отсутствует в том
//   же источнике. Для *Primary Folder* диагностика учитывает каскадный поиск: если имя не найдено
//   ни в самой папке, ни в Workspace, ни в User, то будет ошибка.
//
// Как работает:
//
// - `ResourceStateCoordinator` предоставляет снимок всех OriginEntry — структурированную информацию о задачах
//   из каждого источника, включая их метки и признак «затенённости» (shadowed).
//
// - Для каждого originEntry (источника с файловым представлением) извлекаются узлы задач из
//   JSON‑файла (`extractTaskNodes`).
//
// - `findUnreachableTaskNames` сопоставляет узлы с картой затенённых имён и определяет позиции проблемных
//   задач.
//
// - `findMissingDependencies` проверяет `"dependsOn"` поле каждого узла на наличие имени в множестве доступных
//   для этого источника зависимостей. Для *Primary Folder* множество строится как объединение имён из
//   *User*, *Workspace* и ее самой.
//
// Практическая польза:
// Я х.з, но: делает поведение VS Code более явным, повышая предсказуемость происходящего.
//
// -----
// [^1]: я не придумал как получить профиль текущей сессии VS Code, а значит — не могу
//       добраться до /User/profiles/???/tasks.json.
//
// -----

import {
    DiagnosticSeverity,
    languages,
    LogOutputChannel,
    Range,
    workspace
} from 'vscode';
import * as JSONC from 'jsonc-parser';
import * as assert from 'node:assert/strict';
import ResourceStateCoordinator from '../../ResourceStateCoordinator/ResourceStateCoordinator';
import WindowSettings from '../../WindowSettings/WindowSettings';
import findUnreachableTaskNames from './findUnreachableTaskNames';
import findMissingDependencies from './findMissingDependencies';

import type {
    Diagnostic,
    DiagnosticCollection,
    Disposable,
    Uri
} from 'vscode';
import type Immutable from '../../utils/Immutable';
import type LifecycleOmitted from '../../utils/LifecycleOmitted';
import type OriginEntry from '../../ResourceStateCoordinator/OriginEntry';
import type TaskName from '../../TaskName';
import type OriginEntriesSnapshot from '../../ResourceStateCoordinator/OriginEntriesSnapshot';


declare const ___UpdatePhaseTag: unique symbol;
type UpdatePhaseId = number & { readonly [___UpdatePhaseTag]: never; };

type Code = 'duplicate-label' | 'shadowed-label' | 'missing-dependency';

interface RawDiagnostic {
    code: Code;
    message: string;
    position: { offset: number; length: number; };
}


class DiagnosticsManager implements Disposable {

    static readonly #DEBOUNCE_DELAY_MS = 50;

    static readonly CONFIGURATION_SECTION = 'Validation' as const;
    #validationConfig: WindowSettings.Configuration[typeof DiagnosticsManager.CONFIGURATION_SECTION];

    readonly #diagnosticCollection: DiagnosticCollection;

    #logOutputChannel: LifecycleOmitted<LogOutputChannel> | null;

    #debounceTimer: NodeJS.Timeout | null;

    #phase: 'disposed' | UpdatePhaseId;
    #disposables: Disposable[];

    readonly #dependencies: Readonly<{
        windowSettings: LifecycleOmitted<WindowSettings>;
        resourceStateCoordinator: LifecycleOmitted<ResourceStateCoordinator>;
    }>;

    readonly #diagnosticSource: string | undefined;

    constructor(
        collectionName: string | undefined, // 'Task Cockpit'
        dependencies: Readonly<{
            windowSettings: LifecycleOmitted<WindowSettings>;
            resourceStateCoordinator: LifecycleOmitted<ResourceStateCoordinator>;
        }>,
        logOutputChannel: LifecycleOmitted<LogOutputChannel> | null = null
    ) {

        this.#dependencies = dependencies;
        this.#logOutputChannel = logOutputChannel;

        this.#diagnosticCollection = languages.createDiagnosticCollection(collectionName);

        this.#diagnosticSource = collectionName?.toLowerCase().replaceAll(/\s+/g, '-');

        this.#disposables = [
            this.#diagnosticCollection
        ];

        this.#dependencies.windowSettings.onDidChangeConfiguration((affectedKeys) => {
            if (affectedKeys.has(DiagnosticsManager.CONFIGURATION_SECTION)) {
                this.#validationConfig = this.#dependencies.windowSettings.getConfiguration(DiagnosticsManager.CONFIGURATION_SECTION);
                this.#scheduleUpdate();
            }
        }, this, this.#disposables);

        this.#dependencies.resourceStateCoordinator.onDidStateChange((affectedKeys) => {
            if (affectedKeys.has('TASKS')) {
                this.#scheduleUpdate();
            }
        }, this, this.#disposables);


        this.#debounceTimer = null;

        this.#validationConfig = this.#dependencies.windowSettings.getConfiguration(DiagnosticsManager.CONFIGURATION_SECTION);
        this.#phase = this.#updatePhaseIdGen.next();

        this.#logOutputChannel?.trace(`[${this.constructor.name}] schedule first check`);
        this.#scheduleUpdate();
    }

    dispose() {

        if (this.#phase === 'disposed') { return; }
        this.#phase = 'disposed';

        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }

        this.#disposables.forEach((d) => void d.dispose());

        this.#logOutputChannel?.trace(`[${this.constructor.name}] disposed`);
        this.#logOutputChannel = null;
    }

    #scheduleUpdate(): void {

        if (this.#phase === 'disposed') { return; }

        // Перезапускаем таймер
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }

        const debounceTimer = this.#debounceTimer = setTimeout(() => {
            if (this.#isInoperable) { return; }
            // @todo ????
            // В браузерах это гарантируется спецификацией: задача таймера
            // перед вызовом коллбэка проверяет, жив ли таймер в active
            // timers map. В Node.js — аналогично: таймер помечается как
            // уничтоженный, и runtime пропускает коллбэк.
            // А я х.з
            if (debounceTimer !== this.#debounceTimer) { return; }
            this.#debounceTimer = null;
            void this.#collectDiagnostics().catch((err) => {
                this.#logOutputChannel?.error(`[${this.constructor.name}#collectDiagnostics]`, err);
            });
        }, DiagnosticsManager.#DEBOUNCE_DELAY_MS);
    }


    #deleteStaleDiagnostics(sourcedOriginEntries: Immutable<Array<OriginEntry.Workspace | OriginEntry.Folder>>): void {

        if (this.#phase === 'disposed') { return; }

        const activeUris = new Set(sourcedOriginEntries.map((s) => s.taskSource.uri.toString()));
        const staleUris: Uri[] = [];
        this.#diagnosticCollection.forEach((uri) => {
            if (!activeUris.has(uri.toString())) {
                staleUris.push(uri);
            }
        });
        for (const uri of staleUris) {
            this.#diagnosticCollection.delete(uri);
        }
    }


    async #collectDiagnostics(): Promise<void> {

        if (this.#isInoperable) { return; }
        assert.ok(this.#phase !== 'disposed');
        const capturedPhase = this.#phase = this.#updatePhaseIdGen.next();

        const originEntries = await this.#dependencies.resourceStateCoordinator.getOriginEntries();
        if (capturedPhase !== this.#phase) { return; }
        if (this.#isInoperable) { return; }

        // @todo исключать "скрытые"?
        // User исключён, т.к. у него нет TaskSource
        const sourcedOriginEntries =
            originEntries.Workspace
                ? [originEntries.Workspace, ...originEntries.folders]
                : originEntries.folders;

        this.#deleteStaleDiagnostics(sourcedOriginEntries);

        // this.#logOutputChannel?.trace(`[${this.constructor.name}] config:`, JSON.stringify(this.#validationConfig));
        // this.#logOutputChannel?.trace(`[${this.constructor.name}] projectOrigins count: ${sourcedOriginEntries.length}`);

        const diagnosticsByUri = await Promise.all(sourcedOriginEntries.map(async (originEntry) => {
            const { uri, JSONPath } = originEntry.taskSource;
            try {
                const document = await workspace.openTextDocument(uri);

                if (capturedPhase !== this.#phase) {
                    return { uri, diagnostics: [] };
                }

                const jsoncTree = JSONC.parseTree(document.getText(), undefined, {
                    allowEmptyContent: true,
                    allowTrailingComma: true
                });

                if (!jsoncTree) {
                    return { uri, diagnostics: [] };
                }

                const taskNodes = extractTaskNodes(jsoncTree, [...JSONPath]);

                if (!taskNodes) {
                    return { uri, diagnostics: [] };
                }

                const diagnostics = [
                    ...this.#validationConfig.shadowed
                        ? collectShadowedTaskNameDiagnostics(taskNodes, originEntry)
                        : [],
                    ...this.#validationConfig.dependencies
                        ? collectDependencyDiagnosticsForOrigin(taskNodes, originEntry, originEntries)
                        : []
                ].map((rawDiagnostic) => {
                    return {
                        message: rawDiagnostic.message,
                        range: new Range(document.positionAt(rawDiagnostic.position.offset), document.positionAt(rawDiagnostic.position.offset + rawDiagnostic.position.length)),
                        severity: DiagnosticSeverity.Warning,
                        source: this.#diagnosticSource,
                        code: rawDiagnostic.code
                    } satisfies Diagnostic;
                });

                this.#logOutputChannel?.trace(`[${this.constructor.name}] ${uri.toString()}: ${diagnostics.length} diagnostics`);
                return { uri, diagnostics };

            }
            catch (err) {
                this.#logOutputChannel?.warn(String(err));
                return { uri, diagnostics: [] };
            }
        }));

        if (capturedPhase !== this.#phase) {
            return;
        }

        diagnosticsByUri.forEach((diagnosticEntry) => {
            this.#diagnosticCollection.set(diagnosticEntry.uri, diagnosticEntry.diagnostics);
        });

    }

    #updatePhaseIdGen = (function (id: number) {
        return {
            next() { return ++id as UpdatePhaseId; }
        };
    })(0);


    get #isInoperable(): boolean {

        if (this.#phase === 'disposed') {
            return true;
        }

        const dependenciesDisposed =
            this.#dependencies.resourceStateCoordinator.disposed ||
            this.#dependencies.windowSettings.disposed;

        if (dependenciesDisposed) {
            this.#logOutputChannel?.warn(`[${this.constructor.name}] External dependencies are disposed`);
            return true;
        }

        return false;
    }

}


function extractTaskNodes(jsoncTree: JSONC.Node, JSONPath: Array<string>): Array<JSONC.Node> | null {

    const tasksArrayNode = jsoncTree
        ? JSONC.findNodeAtLocation(jsoncTree, JSONPath)
        : null;

    if (!tasksArrayNode || tasksArrayNode.type !== 'array' || !tasksArrayNode.children) {
        return null;
    }

    return tasksArrayNode.children;
}


function collectShadowedTaskNameDiagnostics(
    taskNodes: JSONC.Node[],
    originEntry: Immutable<OriginEntry.Workspace | OriginEntry.Folder>
): Array<RawDiagnostic> {

    // карта проблемных имён задач: имя задачи → флаг cross-origin затенения
    //  - `true`: имя задачи затенено определением из другой области (cross-origin)
    //  - `false`: конфликт только внутри текущей области (same-origin)
    const shadowedTaskNames = new Map<TaskName, boolean>();

    for (const [taskName, definitionEntry] of originEntry.definitionEntries) {
        if (definitionEntry.shadowed) {
            shadowedTaskNames.set(taskName, definitionEntry.effective === null);
        }
    }

    if (shadowedTaskNames.size < 1) {
        return [];
    }

    return findUnreachableTaskNames(taskNodes, shadowedTaskNames)
        .map((cr) => {
            return cr.isShadowedByOtherOrigin
                ? {
                    code: 'shadowed-label',
                    position: cr.position,
                    message: `Task "${cr.taskLabel}" is unreachable on direct launch: overridden by a definition from another origin.`
                }
                : {
                    code: 'duplicate-label',
                    position: cr.position,
                    message: `Task "${cr.taskLabel}" is defined multiple times. Duplicate labels can cause unexpected behavior.`
                };
        });
}


function collectDependencyDiagnosticsForOrigin(
    taskNodes: JSONC.Node[],
    originEntry: Immutable<OriginEntry.Workspace | OriginEntry.Folder>,
    originEntries: Immutable<OriginEntriesSnapshot>
): Immutable<Array<RawDiagnostic>> {

    const availableTaskNames: Immutable<Map<TaskName, unknown> | Set<TaskName>> =
        ('isPrimary' in originEntry && originEntry.isPrimary)
            ? buildAvailableTaskNamesForPrimaryFolder(originEntry, originEntries)
            : originEntry.definitionEntries;

    if (availableTaskNames.size < 1) {
        return [];
    }

    return findMissingDependencies(taskNodes, availableTaskNames)
        .map((cr) => ({
            code: 'missing-dependency',
            message: `Task definition with label "${cr.taskLabel}" was not found in the current resolution context.`,
            position: cr.position
        }));

}

// Функция собирает имена задач, доступные для разрешения
// зависимостей, когда текущая область — Primary Workspace Folder
function buildAvailableTaskNamesForPrimaryFolder(
    folderOrigin: Immutable<OriginEntry.Folder>,
    originEntries: Immutable<OriginEntriesSnapshot>
): Immutable<Set<TaskName>> {

    const availableTaskNames: TaskName[] = [...originEntries.User.definitionEntries.keys()];

    if (originEntries.Workspace) {
        availableTaskNames.push(...originEntries.Workspace.definitionEntries.keys());
    }

    availableTaskNames.push(...folderOrigin.definitionEntries.keys());

    return new Set(availableTaskNames);
}

export default DiagnosticsManager;
