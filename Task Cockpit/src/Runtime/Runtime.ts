import {
    Disposable,
    EventEmitter,
    type Event,
    tasks as VscTasks,
    window,
    type CancellationToken,
    type Terminal,
    type TaskProcessStartEvent,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type CancellationError,
    LogOutputChannel
} from 'vscode';
import * as assert from 'node:assert/strict';
import getKey from '../Scope/getKey';
import getProcessId from './Terminals/getProcessId';
import Monitor from './Monitor';
import qualifies from '../EligibleTask/qualifies';
import Registry from './Registry';
import SnapshotCollector from './Terminals/SnapshotCollector';
import type ProcessId from './ProcessId';
import type Props from './Props';
import type ScopeKey from '../Scope/Key';
import type Snapshot from './Terminals/Snapshot';
import type TaskIdentifier from './TaskIdentifier';
import type TaskName from '../type.d/TaskName';


/** Отслеживает жизненный цикл процессов, порождённых задачами VS Code.
 *
 * Реагирует на события запуска/завершения процессов и закрытия терминалов,
 * поддерживает реестр процессов,
 * и уведомляет подписчиков об изменениях через {@linkcode onDidChange}.
 *
 * Процесс остаётся в реестре до тех пор, пока виден в терминале,
 * даже после завершения.
 *
 * ## Runtime
 *
 * ### API
 *
 * #### Параметры конструктора:
 * - `monitor` — настройки мониторинга процессов
 * - `terminals` — настройки управления терминалами
 *
 * #### События:
 * - `onDidChange` — изменение состояния процессов задачи
 *
 * #### Свойства:
 * - `registry` — доступ к реестру процессов (только чтение)
 *
 * #### Методы:
 * - `getSnapshot` — снимок процессов задачи с привязкой к терминалам
 * - `abortAll` — запрос на остановку всех живых процессов задачи
 * - `dispose` — деактивация и освобождение ресурсов */
class Runtime implements Disposable {

    readonly #onDidChange: EventEmitter<TaskIdentifier>;

    // #region Events

    /** Изменение состояния процессов.
     *
     * Срабатывает при любом изменении состояния процессов задачи:
     * запуск, завершение, удаление из реестра.
     *
     * Payload — идентификатор затронутой задачи. */
    readonly onDidChange: Event<TaskIdentifier>;

    // #endregion Events

    /** {@link Registry | Реестр процессов} */
    readonly #registry: Registry;

    readonly #disposable: Disposable;

    /** {@link Monitor | Мониторинг процессов} */
    readonly #monitor: Monitor;

    /** {@link SnapshotCollector | Сборщик атомарных снимков PID’ов открытых терминалов} */
    readonly #terminalSnapshot: SnapshotCollector;

    #disposed: boolean;

    #timeout: number;

    // #region Lifecycle

    constructor(
        props: Props,
        logOutputChannel: LogOutputChannel | null = null
    ) {

        this.#disposed = false;

        this.#registry = Registry.create();

        this.#onDidChange = new EventEmitter();
        this.onDidChange = this.#onDidChange.event;

        this.#monitor = new Monitor(props.monitor, logOutputChannel);
        this.#terminalSnapshot = new SnapshotCollector(props.terminals, logOutputChannel);

        this.#timeout = props.terminals.timeout;

        this.#disposable = Disposable.from(

            // Задача породила процесс
            // eslint-disable-next-line @typescript-eslint/unbound-method
            VscTasks.onDidStartTaskProcess(this.#processStartedHandler, this),

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
            // что делает не возможным отследить завершение процесса у задачи.
            // С событием vscode.tasks.onDidEndTaskProcess - то же есть проблемы.
            // -----
            // Процесс(ы) задач(и) сдох(ли)
            // eslint-disable-next-line @typescript-eslint/unbound-method
            this.#monitor.onProcessesCompleted(this.#processCompletedHandler, this),

            // любой терминал закрылся
            // eslint-disable-next-line @typescript-eslint/unbound-method
            window.onDidCloseTerminal(this.#terminalClosedHandler, this),

            // наконец-то обновилось состояние терминалов (возможно протухшее)
            // eslint-disable-next-line @typescript-eslint/unbound-method
            this.#terminalSnapshot.onDidCollectSnapshot(this.#terminalsReconciledHandler, this),

            // -----
            this.#monitor,
            this.#terminalSnapshot,
            // -----
            // эмиттер
            this.#onDidChange

        );
    }


    /** Деактивирует Runtime и освобождает все ресурсы.
     * Останавливает мониторинг, отключает все обработчики событий.
     * Повторный вызов — no-op.
     *
     * @affects onDidChange Больше не будет срабатывать */
    dispose() {

        if (this.#disposed) {
            return;
        }

        this.#disposed = true;
        this.#disposable.dispose();
        this.#registry.clear();

    }

    // #endregion Lifecycle


    // #region Public

    public setProps(props: Readonly<Props>) {

        assert.ok(!this.#disposed, 'SnapshotCollector: use after dispose');

        this.#timeout = this.#setProps(props);
    }


    /** Доступ к реестру процессов (только чтение).
     * */
    get registry(): Readonly<{
        readonly ProcessId: Registry['ProcessId'];
        readonly Stats: Registry['Stats'];
    }> {

        assert.ok(!this.#disposed, 'Runtime: use after dispose');

        return this.#registry;
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
     * @param taskIdentifier Идентификатор задачи
     * @returns Записи `{ processId, terminalRef, running, timestamp }`, отсортированные по `timestamp`.
     *   `terminalRef` — слабая ссылка: к моменту использования терминал может быть
     *   закрыт, переиспользован или уничтожен. Гарантировано только что на момент `timestamp`
     *   Terminal содержал (выполнял) `processId`.
     *   После dispose — пустой массив.
     * @throws { CancellationError } */
    async getSnapshot({ scopeKey, taskName }: TaskIdentifier, token: CancellationToken): Promise<
        ReadonlyArray<Readonly<{
            // Terminal (виджет) продолжает жить своею жизнью: закрывается,
            // пере используется, диспозится...
            terminalRef: WeakRef<Terminal>;
            processId: ProcessId;
            running: boolean;
            timestamp: number;
        }>>
    > {

        assert.ok(!this.#disposed, 'Runtime: use after dispose');

        const pids = this.#registry.ProcessId.get(scopeKey)?.get(taskName);

        if (!pids || pids.size < 1) {
            return [];
        }

        return (await Promise.all(
            window.terminals.map(async (terminal) => {

                // Терминал может быть диспознут в процессе.
                // Сопоставление processId -> Terminal как 1:1 гарантировать не возможно.
                // getTerminalPid выбрасывает только CancellationError.
                // Пры любых проблемах вернет `undefined`.
                // Повисшие/сломанные терминалы вернут `undefined` через таймаут.
                const processId = await getProcessId(terminal, this.#timeout, token);

                if (!processId) {
                    return undefined;
                }

                if (!pids.has(processId)) {
                    return undefined;
                }

                const process = this.#registry.get(processId);

                if (!process) { // состояние реестра могло измениться после await
                    return undefined;
                }

                return {
                    terminalRef: new WeakRef(terminal),
                    processId,
                    ...process
                } as const;
            })
        )).filter(
            (entry): entry is {
                terminalRef: WeakRef<Terminal>;
                processId: ProcessId;
                running: boolean;
                timestamp: number;
            } => entry != null
        ).sort( // Старый первым
            (a, b) => a.timestamp - b.timestamp
        );
    }


    /** Запрос на остановку всех живых процессов задачи.
     *
     * Отправляет `SIGTERM` каждому живому процессу.
     * Мгновенная остановка, как и остановка вообще — не гарантируется.
     * После dispose — no-op.
     *
     * @param taskIdentifier Идентификатор задачи */
    abortAll({ scopeKey, taskName }: TaskIdentifier): void {

        assert.ok(!this.#disposed, 'Runtime: use after dispose');

        const processes = this.#registry.ProcessId.get(scopeKey)?.get(taskName);

        if (!processes || processes.size < 1) {
            return;
        }

        for (const processId of processes) {
            if (this.#registry.get(processId)?.running) {
                this.#killProcess(processId);
            }
        }
    }

    // #endregion Public


    // #region Handlers

    /** Обработка события запуска процесса задачи.
     * Регистрирует процесс, если PID валиден и задача в поддерживаемом scope,
     * затем инициирует пересмотр терминалов.
     *
     * @fires Runtime#onDidChange При успешной регистрации процесса */
    #processStartedHandler({ execution, processId }: TaskProcessStartEvent) {

        if (this.#disposed) {
            return;
        }

        // начинаем следить, если "подходящая"
        if (isValidPid(processId)) { // сразу отбрасываем сломанное

            // если задача "подходит"...
            if (qualifies(execution.task)) { // task -> EligibleTask

                const identifier = { scopeKey: getKey(execution.task.scope), taskName: execution.task.name };

                this.#registry.register(identifier, processId, this.#eventCounter());

                this.#onDidChange.fire(identifier);

                this.#monitor.addTaskProcess(processId);

            }
        }

        // В любом случае — пересмотр терминалов.
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
        this.#terminalSnapshot.enqueueRequest(this.#eventCounter());
    }


    /** Обработка завершённых процессов от {@linkcode Monitor}.
     * - Помечает процессы как завершённые
     * - Сообщает о каждой задаче, затронутой изменением
     * - Инициирует пересмотр терминалов
     *
     * @fires Runtime#onDidChange На каждую затронутую задачу */
    #processCompletedHandler(completed: ReadonlySet<ProcessId>) {

        if (this.#disposed) {
            return;
        }

        const toNotify = this.#registry.markCompleted(completed);

        if (toNotify.size > 0) {
            this.#notify(toNotify);
        }

        // в любом случае — пересмотр терминалов
        this.#terminalSnapshot.enqueueRequest(this.#eventCounter());
    }


    /** Обработка результата сверки терминалов от {@linkcode Terminals}.
     * - Удаляет из реестра процессы, которых больше нет ни в одном терминале
     * - Сообщает о каждой задаче, затронутой удалением
     *
     * @fires Runtime#onDidChange На каждую затронутую задачу */
    #terminalsReconciledHandler(snapshot: Snapshot) {

        if (this.#disposed) {
            return;
        }

        const toNotify = this.#registry.reconcile(snapshot);

        if (toNotify.size < 1) {
            return;
        }

        this.#notify(toNotify);
    }


    /** Обработка закрытия любого терминала.
     * - Инициирует пересмотр всех терминалов. */
    #terminalClosedHandler(_terminal: Terminal) {

        if (this.#disposed) {
            return;
        }

        this.#terminalSnapshot.enqueueRequest(this.#eventCounter());
        // @todo: для оптимизации тут можно проверять и удалять конкретный процесс,
        // а не проверять все терминалы.
        // Оставлю пока так для "а вдруг что-то пропускаю - почистит"

    }

    // #endregion Handlers


    #setProps(props: Readonly<Props>): Readonly<Props['terminals']['timeout']> {

        this.#monitor.setProps(props.monitor);
        this.#terminalSnapshot.setProps(props.terminals);

        return props.terminals.timeout;
    }


    /** Отправка SIGTERM процессу.
     *
     * На Unix — сначала пытается убить группу процессов (`-pid`),
     * при неудаче — fallback на прямой kill.
     * На Windows — только прямой kill.
     *
     * ESRCH (процесс уже мёртв) — не ошибка. Прочие ошибки не пробрасываются — kill не фатален. */
    #killProcess(pid: ProcessId): void {
        try {

            // NO Win: попытка убить группу, fallback на сам процесс
            // Win: попытка убить только сам процесс
            try {
                if (process.platform === 'win32') {
                    process.kill(pid, 'SIGTERM');
                }
                else {
                    process.kill(-(pid as number), 'SIGTERM');
                }
            }
            catch (error) {

                if (error instanceof Error && 'code' in error) {
                    if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
                        return;
                    }
                }

                // для windows тут все
                if (process.platform === 'win32') {
                    return;
                }

                process.kill(pid, 'SIGTERM');
            }

        }
        catch (error) {
            // ESRCH — уже мёртв
            if (error instanceof Error && 'code' in error) {
                if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
                    return;
                }
            }
            // не фатально
            return;
        }
    }

    /** Испускает {@linkcode onDidChange} для каждой задачи из `toNotify` */
    #notify(toNotify: ReadonlyMap<ScopeKey, ReadonlySet<TaskName>>) {
        for (const [scopeKey, taskNames] of toNotify) {
            for (const taskName of taskNames) {
                this.#onDidChange.fire({ scopeKey, taskName });
            }
        }
    }

    // Сейчас
    // - монотонный счетчик. теряем информацию о времени
    // Варианты:
    // - Date.now()
    // - performance.now()
    #eventCounter = (function (start: number) {
        return function () {
            return ++start;
        };
    })(0);

}


/** Проверяет, является ли переданный PID валидным числом > 0.
 *
 * @remarks
 * VS Code не стесняется передавать как PID задачи — `undefined`
 *
 * @param pid PID для проверки
 * @returns true если PID является валидным числом > 0, false иначе */
function isValidPid(pid: number | undefined): pid is ProcessId {
    return (pid !== undefined && pid > 0);
}


export default Runtime;
