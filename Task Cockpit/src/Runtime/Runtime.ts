import {
    tasks,
    window
} from 'vscode';
import * as assert from 'node:assert/strict';
import getTerminalProcessId from './Terminals/getTerminalProcessId';
import ProcessRegistry from './ProcessRegistry';
import ResourceStateCoordinator from '../ResourceStateCoordinator/ResourceStateCoordinator';
import SnapshotCollector from './Terminals/SnapshotCollector';
import TaskProcessMonitor from './TaskProcessMonitor';
import WindowSettings from '../WindowSettings/WindowSettings';

import type {
    Disposable,
    LogOutputChannel,
    TaskProcessStartEvent,
    Terminal
} from 'vscode';
import type Immutable from '../utils/Immutable';
import type LifecycleOmitted from '../utils/LifecycleOmitted';
import type OriginKey from '../OriginKey';
import type RequestId from './RequestId';
import type TaskName from '../TaskName';
import type TaskProcessId from './TaskProcessId';
import type TaskProcessRecord from './TaskProcessRecord';
import type TerminalProcessesSnapshot from './Terminals/TerminalProcessesSnapshot';

type ProcessRegistryView = Runtime.ProcessRegistryView;

declare namespace Runtime {

    /** Публичный интерфейс реестра только для чтения.
     * Скрывает мутирующие методы оставляя только запросы и события. */
    type ProcessRegistryView =
        LifecycleOmitted<Omit<ProcessRegistry, 'register' | 'markCompleted' | 'reconcile'>>;

}

/** Отслеживает жизненный цикл процессов, порождённых задачами VS Code.
 *
 * Реагирует на события запуска/завершения процессов и закрытия терминалов,
 * поддерживает реестр процессов предоставляющий доступ к событию изменения
 * состояния через {@linkcode ProcessRegistry.onDidChangeTaskProcesses}.
 *
 * Процесс остаётся в реестре до тех пор, пока виден в терминале,
 * даже после завершения.
 *
 * ## Runtime
 *
 * ### API
 *
 * #### Параметры конструктора:
 * - `dependencies` — внешние зависимости (`WindowSettings`, `ResourceStateCoordinator`)
 * - `logOutputChannel` — канал логирования (может быть `null`)
 *
 * #### Свойства:
 * - `processRegistry` — доступ к реестру процессов (только чтение)
 *
 * #### Методы:
 * - `getTaskProcessRecords` — снимок процессов задачи с привязкой к терминалам
 * - `terminateAll` — запрос на остановку всех живых процессов задачи
 * - `dispose` — деактивация и освобождение ресурсов
 */
class Runtime implements Disposable {

    static readonly CONFIGURATION_SECTION = 'Terminals' as const;
    #terminalsConfig: WindowSettings.Configuration[typeof Runtime.CONFIGURATION_SECTION];

    readonly #disposables: Disposable[];

    #disposed: boolean;

    // #region Lifecycle

    #logOutputChannel: LifecycleOmitted<LogOutputChannel> | null;

    readonly #dependencies: Readonly<{
        windowSettings: LifecycleOmitted<WindowSettings>;
        resourceStateCoordinator: LifecycleOmitted<ResourceStateCoordinator>;
    }>;

    /** {@link ProcessRegistry | Реестр процессов} */
    readonly #processRegistry: ProcessRegistry;

    /** {@link TaskProcessMonitor | Мониторинг процессов} */
    readonly #processMonitor: TaskProcessMonitor;

    /** {@link SnapshotCollector | Сборщик атомарных снимков PID’ов открытых терминалов} */
    readonly #snapshotCollector: SnapshotCollector;

    constructor(
        dependencies: Readonly<{
            windowSettings: LifecycleOmitted<WindowSettings>;
            resourceStateCoordinator: LifecycleOmitted<ResourceStateCoordinator>;
        }>,
        logOutputChannel: LifecycleOmitted<LogOutputChannel> | null = null
    ) {

        this.#dependencies = dependencies;
        this.#logOutputChannel = logOutputChannel;

        this.#processRegistry = new ProcessRegistry(logOutputChannel);
        this.#processMonitor = new TaskProcessMonitor(this.#dependencies, logOutputChannel);
        this.#snapshotCollector = new SnapshotCollector(this.#dependencies, logOutputChannel);

        this.#disposed = false;
        this.#disposables = [
            this.#processRegistry,
            this.#processMonitor,
            this.#snapshotCollector,
        ];

        this.#dependencies.windowSettings.onDidChangeConfiguration(this.#changeConfigurationHandler, this, this.#disposables);

        this.#terminalsConfig = this.#dependencies.windowSettings.getConfiguration(Runtime.CONFIGURATION_SECTION);

        // Задача породила процесс
        // eslint-disable-next-line @typescript-eslint/unbound-method
        tasks.onDidStartTaskProcess(this.#processStartedHandler, this, this.#disposables);

        // @todo возможно vscode.window.onDidEndTerminalShellExecution лучше? @reject
        // @reject - Bug:
        // Этот подход не работает для задач с "showReuseMessage": false -
        // {
        //     "label": "Test Task 1",
        //     "type": "shell",
        //     "command": "true",
        //     "presentation": {
        //         "showReuseMessage": false,
        //     },
        //     "problemMatcher": []
        // }
        // для таких задач не приходит onDidEndTerminalShellExecution
        // что делает не возможным отследить завершение процесса у задачи. // @todo для каких версий воспроизводится?
        // С событием vscode.tasks.onDidEndTaskProcess - то же есть проблемы:
        // в случае запуска нескольких инстансов одной задачи событие приходит
        // только один раз, для первой завершенной.
        // -----
        // Процесс(ы) задач(и) сдох(ли)
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.#processMonitor.onTaskProcessesCompleted(this.#processCompletedHandler, this, this.#disposables);

        // любой терминал закрылся
        // eslint-disable-next-line @typescript-eslint/unbound-method
        window.onDidCloseTerminal(this.#closeTerminalHandler, this, this.#disposables);

        // Обновилось состояние терминалов (возможно протухшее)
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.#snapshotCollector.onDidCollectSnapshot(this.#collectSnapshotHandler, this, this.#disposables);

    }


    /** Деактивирует {@linkcode Runtime} и освобождает все ресурсы.
     * Останавливает мониторинг, отключает все обработчики событий.
     * Повторный вызов — no-op. */
    dispose() {

        if (this.#disposed) { return; }
        this.#disposed = true;

        this.#disposables.forEach((d) => void d.dispose());

        this.#logOutputChannel?.trace(`[${this.constructor.name}]: disposed`);
        this.#logOutputChannel = null;

    }

    // #endregion Lifecycle


    // #region Public

    public get processRegistry(): ProcessRegistryView {
        return this.#processRegistry;
    }


    /** Снимок зарегистрированных процессов задачи с привязкой к терминалам.
     *
     * Собирает PID каждого открытого терминала и сопоставляет
     * с зарегистрированными процессами задачи.
     * Результат отсортирован по времени запуска (старые первыми).
     *
     * Сопоставление processId → Terminal не гарантировано как 1:1 :
     * повисший терминал не вернёт PID, будет пропущен — запись с этим PID не попадет в результат.
     *
     * @param originKey Идентификатор источника задачи
     * @param taskName Имя задачи
     *
     * @returns Записи {@linkcode TaskProcessRecord}, отсортированные по `timestamp`.
     *   `terminalRef` — слабая ссылка: к моменту использования терминал может быть
     *    закрыт, переиспользован или уничтожен.
     *    Гарантировано только что на момент `timestamp` терминал содержал (выполнял) `taskProcessId`. */
    public async getTaskProcessRecords(originKey: OriginKey, taskName: TaskName): Promise<Immutable<Array<TaskProcessRecord>>> {

        assert.equal(this.#disposed, false, `[${this.constructor.name}#getSnapshot]: use after dispose`);

        const processStates = this.#processRegistry.getTaskProcessStates(originKey, taskName);

        if (!processStates || processStates.size < 1) {
            return [];
        }

        const promises = window.terminals.map(async (terminal) => {

            // Терминал может быть уничтожен в процессе опроса.
            // Сопоставление processId -> Terminal как 1:1 гарантировать не возможно.
            // getTerminalPid при любых проблемах вернет `undefined`.
            // Повисшие/сломанные терминалы вернут `undefined` через таймаут.
            const processId = await getTerminalProcessId(terminal, this.#terminalsConfig.timeout);

            if (!processId) { return undefined; }

            const processState = processStates.get(processId);

            if (!processState) {
                return undefined;
            }

            return {
                terminalRef: new WeakRef(terminal),
                taskProcessId: processId,
                timestamp: processState.registerTimestamp,
                running: processState.running
            } satisfies TaskProcessRecord;
        });

        return (await Promise.all(promises))
            .filter(
                (entry): entry is TaskProcessRecord => entry != null
            ).sort( // Старый первым
                (a, b) => a.timestamp - b.timestamp
            );
    }


    /** Запрос на остановку всех живых процессов задачи.
     *
     * Отправляет `SIGTERM` каждому живому процессу задачи.
     * Мгновенная остановка, как и остановка вообще — не гарантируется.
     *
     * @param originKey Идентификатор источника задачи
     * @param taskName Имя задачи
     *
     * @fires ProcessRegistry#onDidChangeTaskProcesses Со всеми затронутыми задачами
     * */
    public terminateAll(originKey: OriginKey, taskName: TaskName): void {

        assert.ok(!this.#disposed, `[${this.constructor.name}#abortAll]: use after dispose`);

        const processStates = this.#processRegistry.getTaskProcessStates(originKey, taskName);

        if (!processStates || processStates.size < 1) { return; }

        for (const [processId, processState] of processStates) {
            if (processState.running) {
                terminateProcess(processId);
            }
        }
    }

    // #endregion Public


    // #region Handlers

    /** Обработка события запуска процесса задачи.
     * Регистрирует процесс, если PID валиден и задача в поддерживаемом scope,
     * затем инициирует пересмотр терминалов.
     *
     * @fires ProcessRegistry#onDidChangeTaskProcesses Со всеми затронутыми задачами
     * */
    async #processStartedHandler({ execution, processId }: TaskProcessStartEvent): Promise<void> {

        if (this.#isUnusable) { return; }

        // начинаем следить, если "подходящая"
        if (isValidPid(processId)) { // сразу отбрасываем сломанное

            try {
                const taskOriginInfo = await this.#dependencies.resourceStateCoordinator.resolveTaskOrigin(execution.task);

                if (!taskOriginInfo) {
                    // @todo log
                    return;
                }

                // регистрируем процесс
                this.#processRegistry.register(
                    this.#requestIdCounter.next(),
                    taskOriginInfo.originKey,
                    taskOriginInfo.taskName,
                    processId
                );

                // начинаем следить за процессом
                this.#processMonitor.addTaskProcessId(processId);
            }
            catch (err) {
                // @todo log resourceStateCoordinator уничтожен во время ожидания
            }

        }

        if (this.#disposed) { return; }

        // Если процесс задачи "наш" — пересмотр терминалов.
        //
        // Замечание: Реализация getProcessId используемая в SnapshotCollector
        // расценивает закрытый терминал (норм.) или терминал не ответивший
        // за время `timeout` (завис) — как терминал без процесса.
        // Последствия: если vscode смогла получить PID процесса (отправила
        // `onDidStartTaskProcess` с валидным PID), но терминал умудрился сойти
        // с ума уже после этого — снапшот НЕ будет содержать этот PID, как
        // если бы терминал был закрыт.
        // Наличие таких «глючных» терминалов увеличивает время сбора снапшота
        // вплоть до `timeout`, и `onDidCollectSnapshot` станут приходить с
        // непредсказуемой задержкой.
        this.#snapshotCollector.enqueueRequest(this.#requestIdCounter.next());
    }


    /** Обработка завершённых процессов от {@linkcode TaskProcessMonitor}.
     * - Помечает процессы как завершённые
     * - Сообщает о каждой задаче, затронутой изменением
     * - Инициирует пересмотр терминалов
     *
     * @fires ProcessRegistry#onDidChangeTaskProcesses Со всеми затронутыми задачами
     * */
    #processCompletedHandler(completedProcessIds: ReadonlySet<TaskProcessId>) {

        if (this.#disposed) { return; }

        // помечаем процессы как завершенные
        this.#processRegistry.markCompleted(
            this.#requestIdCounter.next(),
            completedProcessIds
        );

        // в любом случае — пересмотр терминалов
        this.#snapshotCollector.enqueueRequest(this.#requestIdCounter.next());
    }


    /** Обработка результата сверки терминалов от {@linkcode SnapshotCollector}.
     *
     * Удаляет из реестра процессы, которых больше нет ни в одном терминале
     *
     * @fires ProcessRegistry#onDidChangeTaskProcesses Со всеми затронутыми задачами
     * */
    #collectSnapshotHandler(snapshot: Immutable<TerminalProcessesSnapshot>) {

        if (this.#disposed) { return; }

        // сопоставить реестр со снимком. Процессы, отсутствующие в снимке будут удалены
        this.#processRegistry.reconcile(snapshot.requestId, new Set(snapshot.terminalProcesses));
    }


    /** Обработка закрытия любого терминала.
     * Инициирует пересмотр всех терминалов.
     *
     * @fires ProcessRegistry#onDidChangeTaskProcesses Со всеми затронутыми задачами*/
    #closeTerminalHandler(_terminal: Terminal) {

        if (this.#disposed) { return; }

        this.#snapshotCollector.enqueueRequest(this.#requestIdCounter.next());
        // @todo: для оптимизации тут можно проверять и удалять конкретный процесс,
        // а не проверять все терминалы.
        // Оставлю пока так для "а вдруг что-то пропускаю - почистит"

    }

    #changeConfigurationHandler(affectedKeys: WindowSettings.AffectedKeys) {
        if (!affectedKeys.has(Runtime.CONFIGURATION_SECTION)) {
            return;
        }
        this.#terminalsConfig = this.#dependencies.windowSettings.getConfiguration(Runtime.CONFIGURATION_SECTION);
    }

    // #endregion Handlers

    #requestIdCounter = (function (start: number) {
        return {
            next() {
                return ++start as RequestId;
            }
        };
    })(0);

    // ---------------------------------------------------------------------------

    get #isUnusable(): boolean {

        const dependenciesDisposed =
            this.#dependencies.resourceStateCoordinator.disposed ||
            this.#dependencies.windowSettings.disposed;

        if (dependenciesDisposed) {
            this.#logOutputChannel?.warn(`[${this.constructor.name}]: External dependencies are disposed`);
        }

        return this.#disposed || dependenciesDisposed;
    }

}


/** Проверяет, является ли переданный PID валидным числом > 0.
 *
 * @remarks
 * VS Code не стесняется передавать как PID задачи — `undefined`
 *
 * @param pid PID для проверки
 * @returns true если PID является валидным числом > 0, false иначе */
function isValidPid(pid: number | undefined): pid is TaskProcessId {
    return (pid !== undefined && pid > 0);
}


/** Отправка SIGTERM процессу.
 *
 * На Unix — сначала пытается убить группу процессов (`-pid`),
 * при неудаче — fallback на прямой kill.
 * На Windows — только прямой kill.
 *
 * ESRCH (процесс уже мёртв) — не ошибка. Прочие ошибки не пробрасываются — kill не фатален. */
function terminateProcess(pid: TaskProcessId): void {

    // Win: попытка убить только сам процесс
    // NO Win: попытка убить группу, fallback на сам процесс

    if (process.platform === 'win32') {
        try {
            process.kill(pid, 'SIGTERM');
        }
        catch {
            return;
        }
    }
    else {
        try {
            process.kill(-(pid as number), 'SIGTERM');
        }
        catch {
            // группы нет или процесс не лидер — пробуем напрямую
            try {
                process.kill(pid, 'SIGTERM');
            }
            catch {
                return;
            }
        }
    }
}


export default Runtime;
