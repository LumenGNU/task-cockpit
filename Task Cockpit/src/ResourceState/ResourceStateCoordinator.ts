/** @file src/ResourceState/ResourceStateCoordinator.ts */

import {
    EventEmitter,
    LogOutputChannel,
    tasks as VscTasks,
    Uri,
    workspace,
} from 'vscode';
import * as assert from 'node:assert/strict';
import EligibleTask from '../EligibleTask';
import mapScopedConfig from './ResourceConfig/mapScopedConfig';
import mapTaskDefinitions from './TaskDefinition/mapTaskDefinitions';
import ScopeKey from '../ScopeKey';
import ResourceConfigurationSchema from './ResourceConfig/ResourceConfigurationSchema';

import type {
    Disposable,
    Event,
    Task as VscTask,
} from 'vscode';
import type ResourceConfig from './ResourceConfig/Config';
import type Safe from '../utils/Safe';
import type TaskName from '../TaskName';
import type Immutable from '../utils/Immutable';
import ScopeLayout from './ScopeLayout';
import type TaskDefinitionEntry from './TaskDefinition/TaskDefinitionEntry';


interface UpdatingPhase { changes: AffectedKeys; }
type Phase = 'idle' | 'disposed' | Immutable<UpdatingPhase>;


export type ConfigKey = ResourceConfigurationSchema.ConfigKey;
export type AffectedKeys = Set<ConfigKey | 'TASKS'>;


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
 * - `UpdatingPhase` — активное обновление.
 * - 'disposed'        — координатор уничтожен, любое обращение к публичному API — ошибка.
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
 * - Отзывчивость – **тут** *не* в приоритете.
 * */
class ResourceStateCoordinator implements Disposable {


    readonly #onDidChange: EventEmitter<Immutable<AffectedKeys>>;

    /** Срабатывает после завершения полного цикла обновления состояния,
     * вызванного изменениями в базовом разделе конфигурации (`baseConfigSection`),
     * разделе задач (`tasks`) или структуре рабочих областей.
     *
     * На момент срабатывания все публичные гетеры возвращают согласованный снимок. */
    readonly onDidChange: Event<Immutable<AffectedKeys>>;

    readonly #onDidDisposed: EventEmitter<void>;
    readonly onDidDisposed: Event<void>;

    // --------------------------------------------------------

    // Снимок состояния (всегда внутренне согласованный набор кешей)
    // #scopeLayout обновляется безусловно на каждом цикле #performUpdate.
    // #eligibleTasks и #taskDefinitions — только при withTasks === true.
    // Расхождения не возникает: единственный источник изменений #scopeLayout —
    // workspace.workspaceFolders, а обработчик onDidChangeWorkspaceFolders
    // всегда планирует обновление с withTasks = true (см. конструктор).
    // Таким образом при изменении структуры папок задачи также пересчитываются.
    // --------------------------------------------------------
    #scopeLayout!: Immutable<ScopeLayout>;
    /** Кеш eligible-задач — "подходящих" рантайм-задач, те что
     * VS Code успешно построила из определений и которые
     * {@link isEligibleTask | соответствует критериям расширения}. */
    #eligibleTasks!: Immutable<Map<ScopeKey, Map<TaskName, EligibleTask>>>;
    /** Кеш определений задач, сгруппированных по областям */
    #taskDefinitions!: Immutable<Map<ScopeKey, Map<TaskName, TaskDefinitionEntry>>>;
    /** Кеш scope-специфичных конфигураций, сгруппированных по областям */
    #perScopeConfiguration!: Immutable<Map<ScopeKey, ResourceConfig>>;
    // --------------------------------------------------------

    // Защита от дребезга между onDidChangeWorkspaceFolders и onDidChangeConfiguration
    // --------------------------------------------------------
    #debounceTimer: NodeJS.Timeout | null;
    #pendingKeys: AffectedKeys | null;
    #debounceDelay: number;
    // --------------------------------------------------------

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
    #phase: Phase;

    // инфраструктура
    // --------------------------------------------------------
    #logOutputChannel: Safe<LogOutputChannel> | null;

    readonly #disposables: Disposable[];

    private constructor(
        vscTasks: Immutable<Array<VscTask>>,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {

        this.#logOutputChannel = logOutputChannel;


        this.#onDidChange = new EventEmitter();
        this.onDidChange = this.#onDidChange.event;

        this.#onDidDisposed = new EventEmitter();
        this.onDidDisposed = this.#onDidDisposed.event;

        this.#debounceTimer = null;
        this.#pendingKeys = null;
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

                this.#logOutputChannel?.trace(`${this.constructor.name}: Workspace folders changed. Scheduling update (with task).`);

                this.#scheduleUpdate(new Set(['TASKS']));

            }),

            workspace.onDidChangeConfiguration((event) => {

                if (this.#phase === 'disposed') {
                    return;
                }

                this.#logOutputChannel?.trace(`${this.constructor.name}: Configuration changed…`);

                const changes: AffectedKeys =
                    // @todo или просто "tasks"? в чем разница?
                    // ключ 'tasks.tasks' реагирует только на изменения в самом массиве задач.
                    // Однако другие изменения внутри раздела tasks (например, tasks.verification,
                    // tasks.version и пр.) тоже могут требовать пересчёта.
                    // Но сейчас нам нужен только список определений и рантайм-задач.
                    // Что-то может изменится в списке рантайм-задач при изменении
                    // в разделе tasks, но не в массиве определений?
                    event.affectsConfiguration('tasks.tasks')
                        ? new Set(['TASKS'])
                        : new Set();

                for (const [key, sectionSet] of ResourceConfigurationSchema.SECTIONS_BY_KEY) {
                    for (const section of sectionSet) {
                        if (event.affectsConfiguration(section)) {
                            changes.add(key);
                            break;
                        }
                    }
                }

                if (changes.size < 1) {
                    this.#logOutputChannel?.trace('  Change does not affect any resource settings or tasks. Ignoring.');
                    return;
                }

                this.#logOutputChannel?.trace(`  Scheduling update with ${[...changes.keys()].map((k) => `"${k}"`).join(', ')}`);

                this.#scheduleUpdate(changes);

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
        deadlineMs: number = 5_000,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ): Promise<ResourceStateCoordinator> {

        const vscTasks = await fetchEligibleTasksUntilStable(deadlineMs, logOutputChannel);

        const stateCoordinator = new ResourceStateCoordinator(
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
        this.#logOutputChannel = null;
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
    public getScopeLayout(): Immutable<ScopeLayout> {

        assert.notEqual(this.#phase, 'disposed', `${this.constructor.name}#getScopeLayout: use after dispose`);

        return this.#scopeLayout;

    }


    public getTaskSource(scopeKey: ScopeKey): Immutable<ScopeLayout.TaskSource> | null {

        assert.notEqual(this.#phase, 'disposed', `${this.constructor.name}#getTaskSource: use after dispose`);

        if (scopeKey === ScopeKey.GLOBAL_KEY) {
            return this.#scopeLayout.globalScope.taskSource;
        }
        else if (scopeKey === ScopeKey.WORKSPACE_KEY) {
            return this.#scopeLayout.workspaceScope?.taskSource ?? null;
        }

        return this.#scopeLayout.folderScopes?.find((f) => f.key === scopeKey)?.taskSource ?? null;

    }


    /** Получить ресурсную конфигурацию для заданной области.
     *
     * @returns {@link ResourceConfig} или `null`, если область не существует
     *          (например, была удалена, а ссылка на неё сохранилась в истории).
     * @throws {AssertionError} если координатор уже disposed. */
    public getResourceConfig(scopeKey: ScopeKey): Immutable<ResourceConfig> | null {

        assert.notEqual(this.#phase, 'disposed', `${this.constructor.name}#getResourceConfig: use after dispose`);

        const config = this.#perScopeConfiguration.get(scopeKey);

        // если состояние согласовано то для существующей scope
        // есть результат (возможно пустой).
        // но если состояние где-то сохраняется (история, пины...) возможен
        // запрос к не существующей scope
        return config ?? null;
    }


    /** Возвращает все определения задач, найденные непосредственно в конфигурации
     * указанной области (scope).
     *
     * Правила слияния областей VS Code **не** применяются.
     * Правила затенения имен **применяются**.
     *
     * @returns словарь {@link TaskDefinition} по {@link TaskName} или `null`,
     *          если область не существует.
     * @throws {AssertionError} если координатор disposed. */
    public getTaskDefinitions(scopeKey: ScopeKey): Immutable<Map<TaskName, TaskDefinitionEntry>> | null {

        assert.notEqual(this.#phase, 'disposed', `${this.constructor.name}#getTaskDefinitions: use after dispose`);
        const map = this.#taskDefinitions.get(scopeKey);
        return map ?? null;
    }


    /** Возвращает рантайм-задачи (EligibleTask), построенные VS Code из определений
     * и доступные для указанной области. Правила слияния областей VS Code уже применены.
     *
     * **Глобальная область и ремаппинг:**
     *
     * VS Code не поддерживает глобальные рантайм‑задачи: даже если определение задачи
     * находится в пользовательских настройках (`User`), рантайм‑задача всегда получает
     * `scope = TaskScope.Workspace`. А `mapEligibleTasks` строит ключи строго по
     * `task.scope`: для любого workspace‑скоупа ключом будет `ScopeKey.WORKSPACE_KEY`.
     *
     * Таким образом, глобальные рантайм-задачи физически лежат в кэше под ключом
     * `ScopeKey.WORKSPACE_KEY` независимо от того, открыта ли рабочая область.
     *
     * Обработка коллизий имён между глобальными и workspace‑задачами также остаётся
     * на стороне VS Code и не прозрачна для расширения.
     *
     * Поэтому при запросе `ScopeKey.GLOBAL_KEY` здесь выполняется ремаппинг
     * `GLOBAL_KEY → WORKSPACE_KEY`: метод возвращает те же задачи, что и для
     * workspace‑области. Это единственное место, где применяется такое
     * преобразование; в `getTaskDefinitions` и `getResourceConfig` оно не нужно —
     * там источники различаются явно (глобальные определения читаются отдельно).
     *
     * @param scopeKey  Ключ интересующей области.
     * @returns Словарь {@link EligibleTask} по {@link TaskName} или `null`, если
     *          область не существует, не содержит задач или VS Code не смогла их построить.
     * @throws {AssertionError} если координатор уже disposed.
     */
    public getEligibleTasks(scopeKey: ScopeKey): Immutable<Map<TaskName, EligibleTask>> | null {

        assert.notEqual(this.#phase, 'disposed', `${this.constructor.name}#getEligibleTasks: use after dispose`);

        // Иначе вернет глобальные рантайм-задачи
        // @todo нужно мне это поведение, или нет?
        if (scopeKey === ScopeKey.WORKSPACE_KEY) {
            if (!this.#scopeLayout.workspaceScope) {
                return null;
            }
        }

        // На самом деле понятия "глобальные" для
        // рантайм-задач не существует, VS Code мержит их
        // в workspace-область:
        //  *Из vscode api*:
        //  > (enum member) TaskScope.Global = 1
        //  > The task is a global task. Global tasks are currently not supported.
        // Т.е.: из определений задач, полученных из global-настроек, VS Code
        // строит рантайм-задачи устанавливая им scope=TaskScope.Workspace.
        // Global-определение-задачи → workspace-рантайм-задача, со всеми вытекающими.
        // Как их потом правильно различать — не понятно.
        // mapEligibleTasks строит ключ строго из task.scope. Если бы VS Code когда‑либо
        // выдала TaskScope.Global, то ключ был бы ScopeKey.GLOBAL_KEY, но на практике этого
        // не происходит. VS Code всегда назначает рантайм‑задачам, порождённым из
        // глобального tasks.json, scope = TaskScope.Workspace. Поэтому в #eligibleTasks они
        // лежат под ключом ScopeKey.WORKSPACE_KEY — независимо от того, открыта ли рабочая область.
        // И даже когда открыта рабочая область — глобальные задачи лежат под ключом ScopeKey.WORKSPACE_KEY.
        // Обработка коллизий имен между global- и workspace- задачами тоже на совести VS Code.
        const _scopeKey =
            scopeKey === ScopeKey.GLOBAL_KEY
                ? ScopeKey.WORKSPACE_KEY
                : scopeKey;

        // даже если состояние согласовано система могла не создавать
        // часть рантайм-задач из определений (есть ошибки в определении).
        // И "пустые" области не попадают в eligibleTasks.
        return this.#eligibleTasks.get(_scopeKey) ?? null;
    }


    /** Принудительный полный пересбор состояния.
     * Может использоваться для выхода из ситуации, когда предыдущий цикл обновления
     * не завершился (например, из-за исключения, оставившего фазу с <UpdatingPhase>),
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

        assert.notEqual(this.#phase, 'disposed', `${this.constructor.name}#forceFullRefresh: use after dispose`);

        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }

        this.#pendingKeys = null;
        this.#phase = {
            changes: new Set(['TASKS', ...ResourceConfigurationSchema.SECTIONS_BY_KEY.keys()])
        };

        return this.#performUpdate();
    }

    // дебонс между onDidChangeWorkspaceFolders и onDidChangeConfiguration
    // для предотвращения спама и возможных, лишних запусков fetchTasks()
    #scheduleUpdate(changes: AffectedKeys): void {

        if (this.#phase === 'disposed') {
            return;
        }

        this.#pendingKeys ??= new Set();
        for (const key of changes) {
            this.#pendingKeys.add(key);
        }

        // Перезапускаем таймер
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }

        this.#debounceTimer = setTimeout(() => {

            this.#debounceTimer = null;

            if (this.#phase === 'disposed') {
                return;
            }

            if (!this.#pendingKeys) {
                // потенциально может обогнать forceFullRefresh
                return;
            }

            const pendingChanges =
                this.#phase === 'idle'
                    ? new Set(this.#pendingKeys)
                    : new Set([...this.#pendingKeys, ...this.#phase.changes]);
            this.#pendingKeys = null;

            this.#phase = { changes: pendingChanges };

            // Запускаем новую работу
            void this.#performUpdate().catch((error) => {

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
                //  - кеш может оказаться частично обновлённым, хотя это разрешится при следующем цикле —
                //    в текущем цикле кеш врет.
                //  - в следующем цикле может повторно бросить, и опять застрять.
                //
                // Поэтому попадание в эту ветку — это баг кода. Эту ветку нельзя правильно
                // обработать не исправляя код. Как и нет "правильной" реакции на такое поведение.
            });
        }, this.#debounceDelay);

    }


    async #performUpdate(): Promise<void> {

        assert.ok(typeof this.#phase !== 'string', 'must only be called when an update phase');

        const capturedPhase = this.#phase;

        this.#logOutputChannel?.trace(`${this.constructor.name}#performUpdate: Updating caches for ${[...capturedPhase.changes.keys()].map((k) => `"${k}"`).join(', ')}`);

        let vscTasks: VscTask[] | null = null;

        if (capturedPhase.changes.has('TASKS')) {
            // ---------------------------
            // Асинхронный блок, получение рантайм-задач
            try {
                vscTasks = await VscTasks.fetchTasks();
            }
            catch (error) {
                // Логируем и рассматриваем список задач как пустой.
                // Если среда стабилизируется, следующее обновление (по изменению
                // конфигурации или ручному refresh) подхватит актуальный список.
                // Сохранять старый кеш когда VS Code явно сигнализирует что среда сломана —
                // нельзя, это ложная картина мира для пользователя.
                // Раз VS Code не может доставить рантайм-задачи, а другого источника не
                // существует — показываем пусто.
                this.#logOutputChannel?.error(`${this.constructor.name}#performUpdate: Tasks.fetchTasks() threw unexpectedly — treating task list as empty.`, error);
                // Сбой в VS Code API — расширение не может и *не должно* восстанавливать задачи.
                vscTasks = [];
            }
        }

        // Сверить фазу, в которой начали, с фактической текущей
        // Результат "нужен", только если фаза строго равна текущей (не менялась).
        if (this.#phase !== capturedPhase) {
            // Могли перейти в другую фазу, или нас обогнали:
            // результат нашей работы уже никому не нужен — выбрасываем

            const reason = typeof this.#phase === 'string'
                ? `phase changed to '${this.#phase}'`
                : 'newer update cycle started';
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
        this.#onDidChange.fire(capturedPhase.changes);
    }


    #updateCaches(vscTasks: Immutable<Array<VscTask>> | null) {

        // scopeLayout пересчитывается безусловно на каждом обновлении,
        // потому что изменение workspaceFolders могло произойти одновременно
        // с изменением конфигурации, и мы не хотим полагаться только на
        // флаг withTasks (который мог быть false). Так мы гарантируем,
        // что структура областей всегда актуальна.
        this.#scopeLayout = ScopeLayout.getLayout();

        // если получали рантайм-задачи
        if (vscTasks != null) {
            this.#eligibleTasks = EligibleTask.mapEligibleTasks(vscTasks);
            this.#taskDefinitions = mapTaskDefinitions(this.#scopeLayout);
        }

        this.#perScopeConfiguration = mapScopedConfig(
            this.#scopeLayout,
            ResourceConfigurationSchema.SCHEMA
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
 * Используется только на этапе {@linkcode ResourceStateCoordinator.create}, пока
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
    // Маркер, что состояние изменилось **пока идет** fetchTasks()
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
            const fetched = await VscTasks.fetchTasks();

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


export {
    ResourceStateCoordinator
};

// -----------
