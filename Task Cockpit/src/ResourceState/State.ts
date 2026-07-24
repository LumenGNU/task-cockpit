/** @file State.ts */

import {
    EventEmitter,
    LogOutputChannel,
    tasks as VscTasks,
    Uri,
    workspace,
} from 'vscode';
import {
    collectSections,
    createSchema
} from '../ConfigSchema';
import * as assert from 'node:assert/strict';
import EligibleTask from '../EligibleTask';
import mapScopedConfig from './ResourceConfig/mapScopedConfig';
import mapTaskDefinitions from './TaskDefinition/mapTaskDefinitions';
import RESOURCE_SCHEMA from './ResourceConfig/SCHEMA';
import ScopeKey from '../ScopeKey';

import type {
    Disposable,
    Event,
    Task as VscTask,
    WorkspaceFolder
} from 'vscode';
import type {
    ConfigSchema
} from '../ConfigSchema';
import type ResourceConfig from './ResourceConfig/Config';
import type Safe from '../utils/Safe';
import type TaskDefinition from './TaskDefinition/TaskDefinition';
import type TaskName from '../TaskName';
import type Immutable from '../utils/Immutable';


declare const ___SourceUri: unique symbol;
declare const ___SourceFile: unique symbol;


export declare namespace State {

    /** Файл-источник определений задач */
    export interface TaskSource {
        uri: SourceUri;
        JSONPath: Array<string>;
    }

    export interface ScopeLayout {
        [ScopeKey.GLOBAL_KEY]: GlobalScope;
        [ScopeKey.WORKSPACE_KEY]: WorkspaceScope | null;
        folders: { [k: ScopeKey.FolderKey]: FolderScope; } | null;
    }

    export interface GlobalScope {
        name: string;
        taskSource: null;
    }

    export interface WorkspaceScope {
        name: string;
        taskSource: TaskSource | null;
    }

    export type FolderScope = WorkspaceFolder & {
        name: string;
        taskSource: TaskSource;
    };


    /** URI файла-источника задач, связанного с указанной областью:
     *
     * **Не проверяется** физическое существование файла на диске — этот файл
     * в любом случае «ассоциирован», существует он или нет.
     *
     * Для Global-области всегда возвращает null.
     * */
    export type SourceUri = Uri & {
        [___SourceUri]: never;
        fsPath: SourceFile;
    };


    export type SourceFile = string & { readonly [___SourceFile]: never; };
    export type Scope = GlobalScope | WorkspaceScope | FolderScope;
}

type TaskSource = State.TaskSource;
type ScopeLayout = State.ScopeLayout;
type SourceUri = State.SourceUri;

declare const ___PhaseId: unique symbol;
type UpdatingPhaseId = number & { readonly [___PhaseId]: never; };

type State = 'idle' | 'disposed' | UpdatingPhaseId;


export type ConfigKey = keyof typeof RESOURCE_SCHEMA | 'TASKS';
export type AffectedKeys = Set<ConfigKey>;


/** Единственный источник согласованного, актуального состояния "ресурсов".
 *
 * Управляет оперативным состоянием расширения:
 * scopes, tasks, eligible‑tasks и ресурсными конфигурациями.
 *
 * Это центральный координатор состояния. Он собирает, кеширует и синхронизирует
 * все динамические данные: список областей (scopes), ресурсные конфигурации,
 * определения задач (TaskDefinition) и построенные VS Code рантайм-задачи (EligibleTask).
 *
 * В основе лежит конечный автомат с фазами:
 * - 'idle'            — согласованное состояние готово, обновление не выполняется.
 * - `UpdatingPhaseId` — активное обновление.
 * - 'disposed'        — координатор уничтожен, любое обращение к публичному API — ошибка.
 *
 * > `UpdatingPhaseId` — уникальный идентификатор цикла *обновления* (см: `#nextPhaseId`).
 *
 * Переходы между фазами обеспечивают предсказуемость и безопасность работы
 * в асинхронной среде.
 *
 * Это единственный источник правды для всего, что может измениться в рантайме.
 *
 * Сам следит за изменениями конфигурации и держит себя в актуальном виде,
 * оповещая подписчиков через onDidChange.
 *
 * onDidChange происходит только после актуализации состояния что
 * важно при изменении в конфигурации "tasks" — нужно дождаться
 * когда vs code перестроит задачи.
 *
 * - Консистентность – событие onDidChange должно отправляться только после
 *     того, как состояние действительно актуализировано (соответствует
 *     последней версии конфигурации).
 * - Не терять изменения
 * - Отзывчивость – тут *не* в приоритете.
 * */
export class StateCoordinator implements Disposable {


    readonly #onDidChange: EventEmitter<void>;

    /** Срабатывает после завершения полного цикла обновления состояния,
     * вызванного изменениями в базовом разделе конфигурации (`baseConfigSection`),
     * разделе задач (`tasks`) или структуре рабочих областей.
     *
     * На момент срабатывания все публичные гетеры возвращают согласованный снимок. */
    readonly onDidChange: Event<void>;

    readonly #onDidDisposed: EventEmitter<void>;
    readonly onDidDisposed: Event<void>;

    // "Конфигурация"
    // --------------------------------------------------------
    /** Базовый ключ конфигурации */
    readonly #baseConfigSection: string;

    /** Схема валидации resource-конфигурации */
    readonly #resourceConfigSchema: Immutable<ConfigSchema<ResourceConfig>>;

    // --------------------------------------------------------

    // Снимок состояния (всегда внутренне согласованный набор кешей)
    // #scopeLayout обновляется безусловно на каждом цикле #performUpdate.
    // #eligibleTasks и #taskDefinitions — только при withTasks === true.
    // Расхождения не возникает: единственный источник изменений #scopeLayout —
    // workspace.workspaceFolders, а обработчик onDidChangeWorkspaceFolders
    // всегда планирует обновление с withTasks = true (см. конструктор).
    // Таким образом при изменении структуры папок задачи также пересчитываются.
    // --------------------------------------------------------
    #scopeLayout!: ScopeLayout;
    /** Кеш eligible-задач — "подходящих" рантайм-задач, те что
     * VS Code успешно построила из определений и которые
     * {@link isEligibleTask | соответствует критериям расширения}. */
    #eligibleTasks!: Immutable<Map<ScopeKey, Map<TaskName, EligibleTask>>>;
    /** Кеш определений задач, сгруппированных по областям */
    #taskDefinitions!: Immutable<Map<ScopeKey, Map<TaskName, TaskDefinition>>>;
    /** Кеш scope-специфичных конфигураций, сгруппированных по областям */
    #perScopeConfiguration!: Immutable<Map<ScopeKey, ResourceConfig>>;
    // --------------------------------------------------------

    // Защита от дребезга между onDidChangeWorkspaceFolders и onDidChangeConfiguration
    // --------------------------------------------------------
    #debounceTimer: NodeJS.Timeout | null;
    #pendingWithTask: boolean;
    #debounceDelay: number;
    // --------------------------------------------------------

    readonly #sectionsByKey: Immutable<Map<ConfigKey, Array<string>>>;

    /** Текущая фаза координатора.
     *
     * "чем сейчас занят координатор"
     *
     * Сессия обновления: период пока координатор находится в фазе updating.
     * Начинается при первом переходе idle → updating, заканчивается переходом
     * updating → idle + нотификацией.
     * Внутри сессии возможны перезапуски #performUpdate (updating → updating).
     *
     *  */
    #phase: State;

    // инфраструктура
    // --------------------------------------------------------
    readonly #logOutputChannel: Safe<LogOutputChannel> | null;

    readonly #disposables: Disposable[];

    private constructor(
        baseConfigSection: string,
        vscTasks: Immutable<Array<VscTask>>,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {

        this.#logOutputChannel = logOutputChannel;

        // Подготовка "конфигурации"
        this.#baseConfigSection = baseConfigSection;
        this.#resourceConfigSchema = createSchema<ResourceConfig>(RESOURCE_SCHEMA);
        this.#sectionsByKey = collectSections<ResourceConfig>(this.#resourceConfigSchema);

        this.#onDidChange = new EventEmitter();
        this.onDidChange = this.#onDidChange.event;

        this.#onDidDisposed = new EventEmitter();
        this.onDidDisposed = this.#onDidDisposed.event;

        this.#debounceTimer = null;
        this.#pendingWithTask = false;
        this.#debounceDelay = 25;

        this.#disposables = [
            // events
            this.#onDidChange,
            this.#onDidDisposed,

            // listeners
            workspace.onDidChangeWorkspaceFolders((_event) => {

                if (this.#phase === 'disposed') {
                    return;
                }

                logOutputChannel?.trace(`${this.constructor.name}: Workspace folders changed. Scheduling update (with task).`);

                this.#scheduleUpdate(true);

            }),

            workspace.onDidChangeConfiguration((event) => {

                if (this.#phase === 'disposed') {
                    return;
                }

                logOutputChannel?.trace(`${this.constructor.name}: Configuration changed…`);

                const tasksChanged = event.affectsConfiguration('tasks');
                const baseSectionChanged = event.affectsConfiguration(this.#baseConfigSection);

                if (!tasksChanged && !baseSectionChanged) {
                    // Нерелевантное событие — не наше дело.
                    logOutputChannel?.trace('  Change does not affect extension settings or tasks. Ignoring.');
                    return;
                }

                const changes: AffectedKeys = tasksChanged ? new Set<ConfigKey>(['TASKS']) : new Set();

                for (const [key, sectionSet] of this.#sectionsByKey) {
                    for (const section of sectionSet) {
                        if (event.affectsConfiguration(`${this.#baseConfigSection}.${section}`)) {
                            changes.add(key);
                            break;
                        }
                    }
                }


                if (changes.size < 1) {
                    logOutputChannel?.trace('  Change does not affect any resource settings or tasks. Ignoring.');
                    return;
                }

                logOutputChannel?.trace(`  Scheduling update with ${[...changes.keys()].map((k) => `"${k}"`).join(', ')}`);

                this.#scheduleUpdate(changes.has('TASKS'));

            })
        ];

        // ----------------------------------------------
        // Получение начального снимка, подготовка кешей
        this.#updateCaches(vscTasks);

        // кеш должен быть полностью обновлен перед началом
        assert.ok(this.#scopeLayout);
        assert.ok(this.#eligibleTasks);
        assert.ok(this.#taskDefinitions);
        assert.ok(this.#perScopeConfiguration);

        // начинаем в 'idle' — полное состояние, работа не выполняется
        this.#phase = 'idle';
    }


    /** Фабрика.
     *
     * Асинхронно собирает рантайм-задачи (устойчиво к гонке с
     * изменением конфигурации прямо во время запроса) и только потом
     * возвращает готовый, согласованный экземпляр.
     *
     * @throws { Error } Выбрасывает наверх ошибки fetchTasks .
     * @throws { TimedOutError } Если система не стабилизировалась, а `deadlineMs` вышел.
     *
     *  */
    static async create(
        baseConfigSection: string,
        deadlineMs: number = 15_000,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ): Promise<StateCoordinator> {

        const vscTasks = await fetchEligibleTasksUntilStable(deadlineMs, logOutputChannel);

        const stateCoordinator = new StateCoordinator(
            baseConfigSection,
            vscTasks,
            logOutputChannel
        );

        return stateCoordinator;
    }


    /** Уничтожает координатор: уведомляет подписчиков через {@link onDidDisposed},
     * отключает все слушатели, очищает таймеры и переводит фазу в `'disposed'`.
     *
     * Повторный вызов безопасен. */
    public dispose() {

        if (this.#phase === 'disposed') {
            return;
        }

        this.#phase = 'disposed';

        // Остановка дебонс-механизма
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }

        // уведомляем использователей, позволяем им
        // правильно завершить им с нами работать.
        // Обращение к публичному api после dispose (и как реакцию на этот fire) — ошибка.
        this.#onDidDisposed.fire();

        this.#disposables.forEach(function (d) {
            d.dispose();
        });

        this.#logOutputChannel?.trace(`${this.constructor.name}: disposed`);
    }

    public get disposed(): boolean {
        return this.#phase === 'disposed';
    }


    /** Возвращает актуальный снимок структуры областей (scopes) — глобальной,
     * рабочей области и папок — в виде {@link ScopeLayout}.
     *
     * Снимок соответствует последнему завершённому циклу обновления и внутренне
     * согласован с другими кешами (задачи, конфигурации).
     *
     * @returns Неизменяемый {@link ScopeLayout}. Поля `workspace` и `folders`
     *          могут быть `null`, если workspace не открыт или папки отсутствуют.
     * @throws {AssertionError} Если координатор уже disposed.
     */
    public getScopeLayout(): ScopeLayout {

        assert.notEqual(this.#phase, 'disposed', `${this.constructor.name}#getScopeLayout: has been disposed`);

        return this.#scopeLayout;

    }


    public getTaskSource(scopeKey: ScopeKey): Immutable<TaskSource> | null {

        assert.notEqual(this.#phase, 'disposed', `${this.constructor.name}#getTaskSource: has been disposed`);

        return scopeKey === ScopeKey.GLOBAL_KEY
            ? this.#scopeLayout[ScopeKey.GLOBAL_KEY].taskSource
            : scopeKey === ScopeKey.WORKSPACE_KEY
                ? this.#scopeLayout[ScopeKey.WORKSPACE_KEY]?.taskSource ?? null
                : this.#scopeLayout.folders?.[scopeKey]?.taskSource ?? null;
    }


    /** Получить ресурсную конфигурацию для заданной области.
     *
     * @returns {@link ResourceConfig} или `null`, если область не существует
     *          (например, была удалена, а ссылка на неё сохранилась в истории).
     * @throws {AssertionError} если координатор уже disposed. */
    public getResourceConfig(scopeKey: ScopeKey): Immutable<ResourceConfig> | null {

        assert.notEqual(this.#phase, 'disposed', `${this.constructor.name}#getResourceConfig: has been disposed`);

        const config = this.#perScopeConfiguration.get(scopeKey);

        // если состояние согласовано то для существующей scope
        // есть результат (возможно пустой).
        // но если состояние где-то сохраняется (история, пины...) возможен
        // запрос к не существующей scope
        return config ?? null;
    }


    /** Возвращает все определения задач, найденные непосредственно в конфигурации
     * указанной области (scope). Правила слияния областей VS Code **не** применяются.
     *
     * @returns словарь {@link TaskDefinition} по {@link TaskName} или `null`,
     *          если область не существует.
     * @throws {AssertionError} если координатор disposed. */
    public getTaskDefinitions(scopeKey: ScopeKey): Immutable<Map<TaskName, TaskDefinition>> | null {

        assert.notEqual(this.#phase, 'disposed', `${this.constructor.name}#getTaskDefinitions: has been disposed`);
        const map = this.#taskDefinitions.get(scopeKey);
        return map ?? null;
    }


    /** Возвращает рантайм-задачи (EligibleTask), построенные VS Code из определений
     * и доступные для указанной области. Правила слияния областей VS Code уже применены.
     *
     * **Важно:** Для глобальной области (`ScopeKey.GLOBAL_KEY`) фактически
     * возвращаются задачи workspace, потому что VS Code не поддерживает глобальные
     * рантайм-задачи и объединяет их с workspace. Ремаппинг выполняется только здесь,
     * в отличие от {@link getTaskDefinitions} и {@link getResourceConfig}.
     *
     * @returns словарь {@link EligibleTask} по {@link TaskName} или `null`, если
     *          область не существует, не содержит задач или VS Code не смогла их построить.
     * @throws {AssertionError} если координатор disposed. */
    public getEligibleTasks(scopeKey: ScopeKey): Immutable<Map<TaskName, EligibleTask>> | null {

        assert.notEqual(this.#phase, 'disposed', `${this.constructor.name}#getEligibleTasks: has been disposed`);

        // На самом деле понятия "глобальные" для
        // рантайм-задач не существует, VS Code мержит их
        // в workspace-область:
        //  *Из vscode api*:
        //  > (enum member) TaskScope.Global = 1
        //  > The task is a global task. Global tasks are currently not supported.
        // Как их потом правильно различать — не понятно.
        //
        // Ремаппинг Global → Workspace сделан ТОЛЬКО здесь, намеренно.
        // getResourceConfig/getTaskDefinitions его не делают и не должны:
        // там Global — валидная самостоятельная область (есть конфигурация
        // и определения задач, заданные именно в глобальном конфиге).
        // Ремаппинг актуален только для рантайм-задач (EligibleTask), для которых
        // понятия "глобальный" физически не существует.
        const _scopeKey =
            scopeKey === ScopeKey.GLOBAL_KEY
                ? ScopeKey.WORKSPACE_KEY
                : scopeKey;

        // даже если состояние согласовано система могла не создавать
        // часть рантайм-задач из определений. И "пустые" области не попадают в eligibleTasks.
        return this.#eligibleTasks.get(_scopeKey) ?? null;
    }


    /** Принудительный полный пересбор состояния.
     * Может использоваться для выхода из ситуации, когда предыдущий цикл обновления
     * не завершился (например, из-за исключения, оставившего фазу с <UpdatingPhaseId>),
     * или когда пользователь вручную запрашивает обновление.
     *
     * Сбрасывает отложенный дебаунс-таймер, немедленно запускает
     * {@link #performUpdate} с полным пересчётом задач.
     *
     * Ошибка, возникшая в процессе, пробрасывается вызывающей стороне;
     * координатор при этом может остаться в несогласованном состоянии,
     * поэтому вызывающий код должен предусмотреть восстановление/показать ошибку пользователю.
     */
    public forceFullRefresh(): Promise<void> {

        assert.notEqual(this.#phase, 'disposed', `${this.constructor.name}#forceFullRefresh: has been disposed`);

        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }

        this.#pendingWithTask = false;
        return this.#performUpdate(true);
    }

    // дебонс между onDidChangeWorkspaceFolders и onDidChangeConfiguration
    // для предотвращения спама и возможных, лишних запусков fetchTasks()
    #scheduleUpdate(withTasks: boolean): void {

        if (this.#phase === 'disposed') {
            return;
        }

        this.#pendingWithTask ||= withTasks;

        // Перезапускаем таймер
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }

        this.#debounceTimer = setTimeout(() => {

            this.#debounceTimer = null;

            if (this.#phase === 'disposed') {
                return;
            }

            const withTasks = this.#pendingWithTask;
            this.#pendingWithTask = false;

            // Запускаем новую работу
            void this.#performUpdate(withTasks).catch((error) => {

                this.#logOutputChannel?.error(`${this.constructor.name}#performUpdate: unexpected error`, error);
                // @todo форс-переход? но куда? и с каким обоснованием?
                // @reject это состояние недостижимо при соблюдении контрактов нижележащих функций,
                // и если оно достигнуто — чинить нужно контракт, а не добавлять сюда recovery-логику.
                // Координатору некуда переходить и продолжать работу, его инструментарий сломан:
                // теперь любое состояние не может считаться ни актуальным, ни согласованным.
                // "Не бросало раньше" — не значит "соблюдало контракт раньше": не-throw — лишь
                // часть контракта, а не весь. Раз здесь он доказано нарушен, нет оснований
                // доверять и тем результатам того же кода, что были построены ранее без исключений.
                //
                // Все, остановка. Отказ от обслуживания — код сломан!
                // (художественное преувеличение, не описание фактического поведения. Но...)
                // Координатор оживает при следующем изменении.
                // Проблема:
                //  - кеш может оказаться частично обновлённым, но это разрешится при следующем цикле.
                //  - может повторно бросить и опять застрять.
                //
                // Поэтому попадание в эту ветку — это баг кода. Эту ветку нельзя правильно
                // обработать не исправляя код. Как и нет "правильной" реакции на такое поведение.
            });
        }, this.#debounceDelay);

    }


    #nextPhaseId = (function (increment: number) {
        return function () {
            return ++increment as UpdatingPhaseId;
        };
    })(0);


    async #performUpdate(withTasks: boolean): Promise<void> {

        if (this.#phase === 'disposed') {
            return;
        }

        const memorizedPhase = this.#phase = this.#nextPhaseId();

        let vscTasks: VscTask[] | null = null;

        if (withTasks) {
            // ---------------------------
            // Асинхронный блок получения рантайм-задач
            try {
                vscTasks = await VscTasks.fetchTasks();
            }
            catch (error) {
                // Сбой в VS Code API — расширение не может восстановить задачи.
                // Логируем и рассматриваем список задач как пустой.
                // Если среда стабилизируется, следующее обновление (по изменению
                // конфигурации или ручному refresh) подхватит актуальный список.
                this.#logOutputChannel?.error(`${this.constructor.name}#performUpdate: Tasks.fetchTasks() threw unexpectedly — treating task list as empty.`, error);
                vscTasks = [];
            }
        }

        // Сверить фазу, в которой начали, с фактической текущей
        // Результат "нужен", только если фаза строго равна текущей (не менялась).
        if (this.#phase !== memorizedPhase) {
            // Могли перейти в другую фазу, или нас обогнали:
            // результат нашей работы уже никому не нужен — выбрасываем

            const reason = typeof this.#phase === 'number'
                ? 'newer update cycle started'
                : `phase changed to '${this.#phase}'`;
            this.#logOutputChannel?.trace(
                `${this.constructor.name}#performUpdate: stale — ${reason}, discarding results`
            );
            return;
        }
        // -----
        // Только если дошли сюда — обновляем кеши.
        // Иначе все результаты выбрасываются — гетеры продолжать
        // отдавать, возможно, старое но согласованное состояние.
        // Так и задумано:
        // - кеши могут устаревать, но в таком случае гарантируется
        //     повторный запуск и onDidChange.
        // - между onDidChange — кеши взаимно согласованы.
        // ------------------------

        // если выше получали рантайм-задачи (успешно или нет)
        // будет обновление и кеша задач, иначе только конфигурации

        // Вызываемые функции обязаны не бросать исключений
        // и всегда возвращать результат (возможно, пустой). Их контракт —
        // их ответственность.
        this.#updateCaches(vscTasks);

        // Снапшот получен
        this.#phase = 'idle';
        this.#onDidChange.fire();
    }


    #updateCaches(vscTasks: Immutable<Array<VscTask>> | null) {

        // scopeLayout пересчитывается безусловно на каждом обновлении,
        // потому что изменение workspaceFolders могло произойти одновременно
        // с изменением конфигурации, и мы не хотим полагаться только на
        // флаг withTasks (который мог быть false). Так мы гарантируем,
        // что структура областей всегда актуальна.
        this.#scopeLayout = getScopes();

        // если получали рантайм-задачи
        if (vscTasks != null) {
            this.#eligibleTasks = EligibleTask.mapEligibleTasks(vscTasks);
            this.#taskDefinitions = mapTaskDefinitions(this.#scopeLayout);
        }

        this.#perScopeConfiguration = mapScopedConfig(
            this.#scopeLayout,
            this.#baseConfigSection,
            this.#resourceConfigSchema
        );
    }

}


// -----

class TimedOutError extends Error {
    constructor(actor: string) {
        super(`${actor}: stabilization attempts aborted — allotted time expired while configuration was still changing`);
    }
}


/** Тянет рантайм-задачи, перезапускаясь, если конфигурация задач поменялась
 * прямо во время запроса — иначе есть риск получить уже устаревший результат.
 * Используется только на этапе {@linkcode StateCoordinator.create}, пока
 * экземпляра ещё нет и полагаться на обработчик `onDidChangeConfiguration`
 * нельзя.
 *
 * Есть защита от ухода в бесконечный цикл, если система постоянно в нестабильном
 * состоянии.
 * Внимание: "защита **от ухода в бесконечный цикл**", а не "защита от медленного fetchTasks".
 *
 * @throws { Error } Выбрасывает наверх ошибки {@linkcode VscTasks.fetchTasks}.
 * @throws { TimedOutError } Если система не стабилизировалась за `deadlineMs`.
 */
async function fetchEligibleTasksUntilStable(
    deadlineMs: number,
    logOutputChannel: Safe<LogOutputChannel> | null
): Promise<Immutable<Array<VscTask>>> {

    let timedOutFlag = false;
    let dirtyFlag: boolean;

    // Общий таймаут на весь процесс запуска.
    // НЕ race между fetchTasks и таймаутом — никаких утверждений
    // о состоянии системы, не дождавшись ответа, делать нельзя.
    // Если fetchTasks висит 3 часа - мы ждем три часа. Если потом
    // dirtyFlag поднят - мы просто не делаем следующую попытку.
    // Если бросить ждать через deadlineMs - где гарантия что
    // fetchTasks не зарезолвился бы через deadlineMs+1 ?
    const timeoutHandle = setTimeout(() => {
        timedOutFlag = true;
    }, deadlineMs);

    // Начинаем следить за изменениями в задачах.
    const listeners = [
        workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('tasks')) {
                // изменение в задачах поднимет dirtyFlag
                dirtyFlag = true;
            }
        }),
        workspace.onDidChangeWorkspaceFolders((_event) => {
            // изменение в структуре проекта поднимет dirtyFlag
            dirtyFlag = true;
        })
    ];


    try {

        while (!timedOutFlag) { // можно перезапускать только пока время не вышло

            // перед попыткой опускаем флаг
            dirtyFlag = false;

            // ...и фетчим задачи
            const fetched =
                await
                    VscTasks.fetchTasks();

            // после попытки смотрим на флаг
            if (dirtyFlag === false) {
                // если успели — возвращаем
                return fetched;
            }

            // если не успели — уходим на следующий круг

            logOutputChannel?.trace(
                `fetchEligibleTasksUntilStable: task environment changed mid-request. ${timedOutFlag ? 'Deadline expired, will throw.' : 'Retrying.'}`
            );

        }

        // если вывалились за цикл — значит время, выделенное на попытки, вышло
        throw new TimedOutError('fetchEligibleTasksUntilStable');

    }
    finally {
        listeners.forEach((d) => { d.dispose(); });
        clearTimeout(timeoutHandle);
    }
}

// -----

/** Формирует снапшот всех активных областей: глобальной (User),
 * рабочей области (workspace) и папок (workspace folders).
 *
 * Глобальная область *не имеет sourceUri*.
 *
 * Workspace-область может быть null (нет открытого workspace),
 * папки — null, если workspaceFolders отсутствуют.
 */
function getScopes(): ScopeLayout {
    return {
        [ScopeKey.GLOBAL_KEY]: {
            name: 'User',
            taskSource: null
        },
        [ScopeKey.WORKSPACE_KEY]:
            (workspace.workspaceFile)
                ? {
                    name: workspace.name ?? '«untitled workspace»',
                    taskSource: {
                        uri: workspace.workspaceFile as SourceUri,
                        JSONPath: ['tasks', 'tasks']
                    }
                }
                : null,
        folders:
            (workspace.workspaceFolders && workspace.workspaceFolders.length > 0)
                ? workspace.workspaceFolders.reduce((obj, scope) => {
                    const key = scope.uri.toString() as ScopeKey.FolderKey;
                    const taskSource = {
                        uri: Uri.joinPath(scope.uri, '.vscode', 'tasks.json') as SourceUri,
                        JSONPath: ['tasks']
                    };
                    obj[key] = { taskSource, ...scope };
                    return obj;
                }, {} as { [k: ScopeKey.FolderKey]: State.FolderScope; })
                : null
    } satisfies ScopeLayout;
}




// -----------
