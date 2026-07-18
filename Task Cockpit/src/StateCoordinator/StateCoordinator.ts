import {
    EventEmitter,
    LogOutputChannel,
    tasks as VscTasks,
    workspace,
} from 'vscode';
import {
    collectSections,
    createSchema
} from './ConfigSchema/ConfigSchema';
import * as assert from 'node:assert/strict';
import getScopeKey from '../Scope/getKey';
import GLOBAL_SCOPE from '../Scope/Global/Global';
import isGlobal from '../Scope/isGlobal';
import mapEligibleTasks from './EligibleTask/mapEligibleTasks';
import mapScopedConfig from './mapScopedConfig';
import mapTaskDefinitions from './TaskDefinition/mapTaskDefinitions';
import readWindowConfig from './readWindowConfig';
import RESOURCE_SCHEMA from './ConfigSchema/Resource/SCHEMA';
import WINDOW_SCHEMA from './ConfigSchema/Window/SCHEMA';
import WORKSPACE_SCOPE from '../Scope/Workspace/Workspace';

import {
    type Disposable,
    type Event,
    type Task as VscTask
} from 'vscode';
import {
    type ConfigSchema
} from './ConfigSchema/ConfigSchema';
import type EligibleMap from './EligibleTask/EligibleMap';
import type EligibleTask from './EligibleTask/EligibleTask';
import type FolderScope from '../Scope/Folder/Folder';
import type GlobalScope from '../Scope/Global/Global';
import type Immutable from '../utils/Immutable';
import type ResourceConfig from './ConfigSchema/Resource/Config';
import type Safe from '../utils/Safe';
import type Scope from '../Scope/Scope';
import type ScopeKey from '../Scope/Key';
import type TaskDefinition from './TaskDefinition/TaskDefinition';
import type TaskName from '../TaskName/TaskName';
import type WindowConfig from './ConfigSchema/Window/Config';
import type WorkspaceScope from '../Scope/Workspace/Workspace';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type isEligibleTask from './EligibleTask/isEligibleTask';


type WindowConfigKey = keyof typeof WINDOW_SCHEMA;


declare namespace StateCoordinator {
    export type ChangeKey = 'ANY' | 'TASKS' | WindowConfigKey;
    type ChangeSet = Set<ChangeKey>;
}

type ChangeKey = StateCoordinator.ChangeKey;

/** Набор ключей изменений конфигурации. */
type ChangeSet = StateCoordinator.ChangeSet;


type State =
    | {
        kind: 'idle';
    }
    | {
        kind: 'updating';
        /** Аккумулятор ключей за всю сессию, ещё не нотифицированных.
         *
         * Часть механизма гранулярного уведомления для подписчиков, которым
         * желательно обновиться только при изменении конкретной секции
         * настроек. Пры переходе 'updating' → 'updating' ключи, о которых
         * еще не уведомлялось, будут перенесены из "старой" фазы
         * в "новую".
         * */
        pendingChanges: Set<ChangeKey>;
    }
    | {
        kind: 'disposed';
    };


/** Единственный источник согласованного, актуального состояния.
 * Класс управляет всем оперативным состоянием расширения:
 * настройками, scopes, tasks, eligible‑tasks, конфигурации, а в перспективе
 * ещё и UI‑состояния (закреплённые задачи, раскрытые узлы и т.п.).
 *
 * Представляет собой центральный координатор состояния, синглтон.
 *
 * Отвечает за сбор, кеширование и синхронизацию всех динамических данных:
 * конфигураций (оконных и ресурсных), списка доступных областей (scopes),
 * определений задач (TaskDefinition) и «подходящих» задач (EligibleTask).
 *
 * Архитектура выстроена вокруг конечного автомата с фазами idle, updating
 * и disposed, что делает поток управления предсказуемым и позволяет
 * безопасно работать в асинхронной среде.
 *
 * Это единственный источник правды для всего, что может измениться в рантайме.
 *
 * Сам следит за изменениями конфигурации и держит себя в актуальном виде,
 * оповещая подписчиков через onDidChange.
 *
 * Эта штука держит вместе и синхронизирует источники данных.
 * onDidChange происходит только после актуализации состояния что
 * важно при изменении в конфигурации tasks -- нужно дождаться
 * когда vs code перестроит задачи.
 *
 * - Консистентность – событие onDidChange должно отправляться только после
 *     того, как состояние действительно актуализировано (соответствует
 *     последней версии конфигурации).
 * - Не терять изменения – если между двумя событиями изменились разные секции,
 *     итоговое уведомление должно включать все затронутые ключи.
 * - Отзывчивость – тут *не* в приоритете.
 * */
class StateCoordinator implements Disposable {

    static #instance: StateCoordinator | null = null;

    readonly #onDidChange: EventEmitter<Immutable<ChangeSet>>;

    /** Срабатывает при любом изменении конфигурации, затронувшем базовый раздел
     * (`baseConfigSection`) и/или раздел задач (`tasks`) и/или при изменении
     * структуры проекта.
     *
     * Содержимое `ChangeSet`:
     * - `'ANY'` — любые релевантные изменения, присутствует всегда.
     * - `'TASKS'` — изменился раздел `tasks.*` — есть изменения в определениях задач.
     *     Или изменилась структура рабочей области (добавление/удаление/переименование каталогов
     *     workspace-based проекта).
     * - {@linkcode WindowConfigKey} — конкретный ключ window-конфигурации, чьи секции были затронуты.
     *
     * Само событие уже означает наличие релевантных изменений. Дополнительно,
     * наличие ключа {@linkcode WindowConfigKey} означает — изменение в конкретной
     * window-секции что позволяет конкретным суб-модулям пропускать свое обновление если
     * изменение их не затрагивает.
     *
     * О затронутых ключах в resource-конфигурации не сообщает — это не нужно.
     *
     * */
    readonly onDidChange: Event<Immutable<ChangeSet>>;

    readonly #onWillBeDisposed: EventEmitter<void>;
    readonly onWillBeDisposed: Event<void>;

    // "Конфигурация"
    // --------------------------------------------------------
    /** Базовый ключ конфигурации */
    readonly #baseConfigSection: string;
    /** Схема валидации window-конфигурации */
    readonly #windowConfigSchema: Immutable<ConfigSchema<WindowConfig>>;
    /** Схема валидации resource-конфигурации */
    readonly #resourceConfigSchema: Immutable<ConfigSchema<ResourceConfig>>;
    /** Карта "ключ window-конфигурации" → все секции конфигурации, принадлежащие этому ключу. */
    readonly #windowSectionsByKey: Immutable<Map<WindowConfigKey, Array<string>>>;
    // --------------------------------------------------------

    // Snapshot (всегда согласованный между собою набор кешей)
    // #scopes пересчитывается в #performUpdate безусловно на каждом цикле,
    // а #eligibleTasks/#taskDefinitions — только если pendingChanges содержит
    // 'TASKS'. Расхождения не возникает, потому что единственный вход #scopes —
    // workspace.workspaceFolders — меняется исключительно через
    // onDidChangeWorkspaceFolders, а этот обработчик всегда планирует update
    // с 'TASKS' в паре (см. конструктор).
    // --------------------------------------------------------
    /** Кеш window-конфигурации */
    #windowConfiguration: Immutable<WindowConfig>;
    /** Кеш eligible-задач — "подходящих" рантайм-задач, те что
     * VS Code успешно построила из определений и которые
     * {@link isEligibleTask | соответствует критериям расширения}. */
    #eligibleTasks: EligibleMap;
    /** Кеш доступных областей-источников */
    #scopes: Immutable<Array<Scope>>;
    /** Кеш определений задач, сгруппированных по областям */
    #taskDefinitions: Immutable<Map<ScopeKey, Map<TaskName, TaskDefinition>>>;
    /** Кеш scope-специфичных конфигураций, сгруппированных по областям */
    #perScopeConfiguration: Immutable<Map<ScopeKey, ResourceConfig>>;
    // --------------------------------------------------------

    // Защита от дребезга между onDidChangeWorkspaceFolders и onDidChangeConfiguration
    // --------------------------------------------------------
    #debounceTimer: NodeJS.Timeout | null;
    #debouncedChanges: Set<ChangeKey> | null;
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
    #phase: Immutable<State>;

    // инфраструктура
    // --------------------------------------------------------
    readonly #logOutputChannel: Safe<LogOutputChannel> | null;

    readonly #disposables: Disposable[];

    private constructor(
        baseConfigSection: string,
        vscTasks: ReadonlyArray<Readonly<VscTask>>,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {

        this.#logOutputChannel = logOutputChannel;

        // Подготовка "конфигурации"
        this.#baseConfigSection = baseConfigSection;
        // Компиляция схем, получение карты секций window-конфигурации
        this.#windowConfigSchema = createSchema<WindowConfig>(WINDOW_SCHEMA);
        this.#resourceConfigSchema = createSchema<ResourceConfig>(RESOURCE_SCHEMA);
        this.#windowSectionsByKey = collectSections<WindowConfig>(this.#windowConfigSchema);

        // ----------------------------------------------
        // Получение начального снимка, подготовка кешей
        this.#scopes = getScopes();
        this.#eligibleTasks = mapEligibleTasks(vscTasks);
        this.#taskDefinitions = mapTaskDefinitions(this.#scopes);
        this.#windowConfiguration = readWindowConfig(
            this.#baseConfigSection,
            this.#windowConfigSchema
        );
        this.#perScopeConfiguration = mapScopedConfig(
            this.#scopes,
            this.#baseConfigSection,
            this.#resourceConfigSchema
        );

        this.#onDidChange = new EventEmitter();
        this.onDidChange = this.#onDidChange.event;

        this.#onWillBeDisposed = new EventEmitter();
        this.onWillBeDisposed = this.#onWillBeDisposed.event;

        this.#debounceTimer = null;
        this.#debouncedChanges = null;
        this.#debounceDelay = 50;

        this.#disposables = [
            // events
            this.#onDidChange,
            this.#onWillBeDisposed,

            // listeners
            workspace.onDidChangeWorkspaceFolders((_event) => {

                if (this.#phase.kind === 'disposed') {
                    return;
                }

                logOutputChannel?.trace('Workspace folders changed. Scheduling update (ANY, TASKS).');

                this.#scheduleUpdate(new Set(['ANY', 'TASKS']));

            }),
            workspace.onDidChangeConfiguration((event) => {

                if (this.#phase.kind === 'disposed') {
                    return;
                }

                logOutputChannel?.trace('Configuration changed…');

                const tasksChanged = event.affectsConfiguration('tasks');
                const baseSectionChanged = event.affectsConfiguration(this.#baseConfigSection);

                if (!tasksChanged && !baseSectionChanged) {
                    // Нерелевантное событие — не наше дело.
                    logOutputChannel?.trace('  Change does not affect extension settings or tasks. Ignoring.');
                    return;
                }

                const changes = new Set<ChangeKey>(['ANY']);

                if (tasksChanged) {
                    changes.add('TASKS');
                }

                // Гранулярный трекинг: для каждого WindowConfigKey определяем, затронула ли
                // хоть одна из принадлежащих ему секций конфигурации текущее событие.
                // Позволяет подписчикам фильтровать нерелевантные обновления window-конфигурации.
                for (const [key, sectionSet] of this.#windowSectionsByKey) {
                    for (const section of sectionSet) {
                        if (event.affectsConfiguration(`${this.#baseConfigSection}.${section}`)) {
                            changes.add(key);
                            break;
                        }
                    }
                }

                logOutputChannel?.trace(`  Scheduling update (${[...changes].join(', ')}).`);

                this.#scheduleUpdate(changes);

            })
        ];

        // начинаем в 'idle' — полное состояние, работа не выполняется
        this.#phase = { kind: 'idle' };
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
    ): Promise<Immutable<StateCoordinator>> {

        // нельзя дважды создавать синглтон
        assert.equal(StateCoordinator.#instance, null);

        const vscTasks = await fetchEligibleTasksUntilStable(deadlineMs, logOutputChannel);

        const stateCoordinator = new StateCoordinator(
            baseConfigSection,
            vscTasks,
            logOutputChannel
        );

        StateCoordinator.#instance = stateCoordinator;
        return stateCoordinator;
    }


    // нет dispose() --- уничтожать можно только по месту создания,
    // не использования
    static getInstance(): Immutable<Safe<StateCoordinator>> | null {

        const stateCoordinator = StateCoordinator.#instance;

        if (!stateCoordinator || stateCoordinator.#phase.kind === 'disposed') {
            return null;
        }

        return stateCoordinator;

    }


    public dispose() {

        if (this.#phase.kind === 'disposed') {
            return;
        }

        StateCoordinator.#instance = null;
        this.#goToPhase('disposed');

        // уведомляем использователей, позволяем им
        // правильно завершить им с нами работать.
        // Обращение к публичному api после dispose (как реакцию на этот fire) — ошибка.
        this.#onWillBeDisposed.fire();

        // Остановка дебонс-механизма
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }
        this.#debouncedChanges = null;

        this.#disposables.forEach(function (d) {
            d.dispose();
        });

        this.#logOutputChannel?.trace(`${this.constructor.name}: disposed`);
    }


    public getScopes(): Immutable<Array<Scope>> {

        assert.notEqual(this.#phase.kind, 'disposed', `${this.constructor.name}#getScopes: has been disposed`);

        return this.#scopes;
    }


    /** Получить "общих" настроек (для суб-модулей). */
    public getWindowConfig(): Immutable<WindowConfig> {

        assert.notEqual(this.#phase.kind, 'disposed', `${this.constructor.name}#getWindowConfig: has been disposed`);

        return this.#windowConfiguration;
    }


    /** Получить настройки, специфичные для конкретной области. */
    public getResourceConfig(scope: Immutable<Scope>): Immutable<ResourceConfig> {

        assert.notEqual(this.#phase.kind, 'disposed', `${this.constructor.name}#getResourceConfig: has been disposed`);

        const config = this.#perScopeConfiguration.get(getScopeKey(scope));

        // если состояние согласовано то для scope есть результат (возможно пустой)
        assert.ok(config, `${this.constructor.name}#getResourceConfig: no configuration found for scope '${getScopeKey(scope)}' — state is inconsistent`);
        return config;
    }


    /** TaskDefinition’ы (определения задач) определенные
     * в указанной scope — правила слияния областей конфигураций
     * VS Code игнорируются. */
    public getTaskDefinitions(scope: Immutable<Scope>): Immutable<Map<TaskName, TaskDefinition>> {

        assert.notEqual(this.#phase.kind, 'disposed', `${this.constructor.name}#getTaskDefinitions: has been disposed`);

        const map = this.#taskDefinitions.get(getScopeKey(scope));

        // если состояние согласовано то для scope есть результат (возможно пустой)
        assert.ok(map, `${this.constructor.name}#getTaskDefinitions: no task definitions found for scope '${getScopeKey(scope)}' — state is inconsistent`);

        return map;
    }


    /** Возвращает задачи, построенные VS Code из определений, доступные для
     * указанной области и проходящие на соответствие {@link EligibleTask} */
    public getEligibleTasks(scope: Immutable<Scope>): Immutable<Map<TaskName, EligibleTask>> {

        assert.notEqual(this.#phase.kind, 'disposed', `${this.constructor.name}#getEligibleTasks: has been disposed`);

        // На самом деле понятия "глобальные" для
        // рантайм-задач не существует, VS Code мержит их
        // в workspace-область:
        //  *Из vscode api*:
        //  > (enum member) TaskScope.Global = 1
        //  > The task is a global task. Global tasks are currently not supported.
        // Как их потом правильно различать — не понятно.
        const _scope = isGlobal(scope) ? WORKSPACE_SCOPE : scope;

        // даже если состояние согласовано система могла не создавать
        // часть рантайм-задач из определений. И "пустые" области не попадают в eligibleTasks.
        return this.#eligibleTasks.get(getScopeKey(_scope)) ?? new Map();
    }

    // дебонс и мерж между onDidChangeWorkspaceFolders и onDidChangeConfiguration
    // для предотвращения спама и возможных, лишних запусков fetchTasks()
    #scheduleUpdate(changes: Immutable<Set<ChangeKey>>): void {

        if (this.#phase.kind === 'disposed') {
            return;
        }

        // Накапливаем изменения
        this.#debouncedChanges ??= new Set();
        for (const key of changes) {
            this.#debouncedChanges.add(key);
        }

        // Перезапускаем таймер

        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }

        this.#debounceTimer = setTimeout(() => {
            this.#debounceTimer = null;
            if (this.#phase.kind === 'disposed') {
                return;
            }
            // tsc не сможет тут сузить
            assert.ok(this.#debouncedChanges, 'debounced changes must be set when timer fires');
            const merged = this.#debouncedChanges;
            this.#debouncedChanges = null;
            this.#goToPhase('updating', merged);
        }, this.#debounceDelay);

    }

    /**
     *
     * @param changes Набор ключей изменений — триггер перехода в фазу 'updating'
     * @affects this.#phase
     * @fires onDidChange
     */
    #goToPhase(newState: 'updating', changes: Immutable<ChangeSet>): void;
    #goToPhase(newState: 'idle' | 'disposed'): void;
    #goToPhase(newState: State['kind'], changes?: Immutable<ChangeSet>): void {

        const currentPhase = this.#phase;

        switch (newState) {

            case 'updating': {

                // 'disposed' -> 'updating'
                if (currentPhase.kind === 'disposed') {
                    assert.fail(`${this.constructor.name}#goToPhase: illegal transition — disposed → updating`);
                }

                // Был запрошен переход в фазу 'updating' — значит была и причина.
                // tsc не сможет тут сузить ChangeSet | undefined до ChangeSet
                assert.ok(changes, `${this.constructor.name}#goToPhase: transition to updating requires a change set`);

                // запоминаем затронутые ключи
                const pendingChanges =
                    currentPhase.kind === 'updating'
                        // при переходе 'updating' -> 'updating' переносим накопленные ключи,
                        // о них еще не уведомлялось
                        ? new Set([...currentPhase.pendingChanges, ...changes])
                        : new Set([...changes]);

                // fetchTasks не поддерживает отмену — #performUpdate
                // увидит после await что его фаза прошла и выйдет самостоятельно
                this.#phase = {
                    kind: 'updating',
                    pendingChanges
                } as const;

                // 'updating' -> 'updating'
                // 'idle' -> 'updating'
                // Запускаем новую работу
                void this.#performUpdate().catch((error) => {
                    // чтобы не zombify
                    this.#logOutputChannel?.error(`${this.constructor.name}#performUpdate: unexpected error`, error);
                    // @todo форс-переход? но куда? и с каким обоснованием?
                });

                break;
            }

            case 'idle': {

                // 'disposed' -> 'idle'
                // 'idle' -> 'idle'
                if (currentPhase.kind === 'disposed' || currentPhase.kind === 'idle') {
                    assert.fail(`${this.constructor.name}#goToPhase: illegal transition — ${currentPhase.kind} → idle`);
                }
                // currentState.kind далее всегда будет 'updating'

                // 'updating' -> 'idle'
                // на всякий случай сначала сменим фазу, потом нотификация
                this.#phase = { kind: 'idle' };
                // Нотификация
                assert.ok(currentPhase.pendingChanges.size > 0, `${this.constructor.name}#goToPhase: transitioned to idle with an empty pending change set`);
                this.#onDidChange.fire(currentPhase.pendingChanges);

                break;
            }

            case 'disposed': {

                // VscTasks.fetchTasks() не умеет отменяться
                // просто переходим в 'disposed' — #performUpdate увидит что он не успел.
                // Очистка ресурсов:
                // ресурсов, связанных со стейт-машиной в даной версии нет

                this.#phase = { kind: 'disposed' };

                break;
            }

            default: {
                const _: never = newState;
                assert.fail(`${this.constructor.name}#goToPhase: unhandled phase in switch — exhaustiveness check failed`);
            }
        }

    }


    async #performUpdate(): Promise<void> {

        assert.ok(this.#phase.kind === 'updating', `${this.constructor.name}#performUpdate: must only be called while in the updating phase`);

        const memorizedPhase = this.#phase;
        const { pendingChanges } = memorizedPhase;


        let vscTasks: VscTask[] | null = null;

        // ---------------------------
        // Асинхронный ~паразит~ блок
        if (pendingChanges.has('TASKS')) {
            try {
                vscTasks = await VscTasks.fetchTasks();
            }
            catch (error) {
                // Неожиданная ошибка означает сбой в среде VS Code — расширение
                // не может это починить и не пытается. Логируем, переходим в
                // "нет задач".
                // Восстановление произойдёт, если среда стабилизируется.
                // Или не произойдет — повлиять на это мы не можем.
                // VS Code уже или сломалась полностью, или показала пользователю ошибку.
                // А я никак это обрабатывать не стану — просто логирую для "полноты картины".
                this.#logOutputChannel?.error(`${this.constructor.name}#performUpdate: Tasks.fetchTasks() threw unexpectedly — treating task list as empty.`, error);
                vscTasks = []; // нет, ну нету — неоткуда взять
            }
        }

        // Сверить фазу, в которой начали, с фактической текущей
        // Результат "нужен", только если фаза строго равна текущей (не менялась).
        if (this.#phase !== memorizedPhase) { // проверяем не сменилась ли фаза за время ожидания?
            // Могли перейти в другую фазу, или нас обогнали:
            // результат нашей работы уже никому не нужен — выбрасываем

            const reason = this.#phase.kind === 'updating'
                ? 'newer update cycle started'
                : `phase changed to '${(this.#phase as State).kind}'`;
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

        // Про возможное не полное обновление:
        // Функции получатели в своих контрактах заявляют "не падаем, всегда возвращаем результат".
        // Защита ИХ контракта — это ИХ проблема. Координатор просто доверяет.

        // Массив доступных областей-источников
        // На всякий случай безусловно, но можно перенести под
        // условие vscTasks != null --
        // только если что-то происходило с задачами состав проекта
        // мог измениться. Но это не точно
        this.#scopes = getScopes();

        if (vscTasks != null) {
            // если выше получали рантайм-задачи (успешно или нет)
            // Обновление кеша задач
            this.#eligibleTasks = mapEligibleTasks(vscTasks);
            this.#taskDefinitions = mapTaskDefinitions(this.#scopes);
        }

        // Обновление кеша конфигураций
        this.#windowConfiguration = readWindowConfig(
            this.#baseConfigSection,
            this.#windowConfigSchema
        );
        this.#perScopeConfiguration = mapScopedConfig(
            this.#scopes,
            this.#baseConfigSection,
            this.#resourceConfigSchema
        );

        // Снапшот получен
        this.#goToPhase('idle');

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
): Promise<ReadonlyArray<Readonly<VscTask>>> {

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

/**
 * Порядок областей всегда фиксирован:
 * 1. {@linkcode GlobalScope} — присутствует обязательно и идёт первым.
 * 2. {@linkcode WorkspaceScope} — следует сразу за `GlobalScope`, если открыта рабочая область.
 * 3. {@linkcode FolderScope} — если есть папки, они завершают список
 *    и располагаются в порядке, предоставленном VS Code.
 *
 * Почему это тут: смотри StateCoordinator.md
 */
function getScopes(): Immutable<Array<Scope>> {

    const scopes: Array<Scope> = [GLOBAL_SCOPE];
    if (workspace.workspaceFile) {
        scopes.push(WORKSPACE_SCOPE);
    }
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        scopes.push(...workspace.workspaceFolders as FolderScope[]);
    }

    return scopes;
}

// -----------

export default StateCoordinator;
