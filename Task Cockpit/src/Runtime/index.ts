/** @file Runtime/index.ts */
/** @module Runtime */

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


import * as vscode from 'vscode';
import EligibleTask from '../EligibleTask';
import Monitor from './Monitor';
import ProcessRegistry from './ProcessRegistry';
import Terminals from './Terminals';
import type ProcessId from '../type.d/ProcessId';
import type TaskId from '../type.d/TaskId';


/** Отслеживает жизненный цикл процессов, порождённых задачами VS Code.
 *
 * Реагирует на события запуска/завершения процессов и закрытия терминалов,
 * поддерживает реестр процессов с флагами `running`/завершён,
 * и уведомляет подписчиков об изменениях через {@linkcode onDidChange}.
 *
 * Процесс остаётся в реестре до тех пор, пока виден в терминале —
 * даже после завершения. */
class Runtime implements vscode.Disposable {

    readonly #onDidChange: vscode.EventEmitter<TaskId>;

    // #region Events

    /** Изменение состояния процессов.
     *
     * Срабатывает при любом изменении состояния процессов задачи:
     * запуск, завершение, удаление из реестра.
     *
     * Payload — идентификатор затронутой задачи. */
    readonly onDidChange: vscode.Event<TaskId>;

    // #endregion Events

    /** Реестр всех процессов по задачам, с их статусами
     *
     * Все процессы остаются здесь с флагами alive/dead,
     * пока видны в терминале.  */
    readonly #registry: ProcessRegistry;

    readonly #disposable: vscode.Disposable;

    /** {@link Monitor | Мониторинг процессов} */
    readonly #monitor: Monitor;

    /** {@link Terminals | Управление терминалами} */
    readonly #terminals: Terminals;

    #disposed: boolean;


    // #region Lifecycle

    constructor(settings: { monitor: Monitor.Settings; terminals: Terminals.Settings; }) {

        this.#disposed = false;

        this.#registry = ProcessRegistry.create();

        this.#onDidChange = new vscode.EventEmitter<TaskId>();
        this.onDidChange = this.#onDidChange.event;

        this.#monitor = new Monitor(settings.monitor);
        this.#terminals = new Terminals(settings.terminals);


        this.#disposable = vscode.Disposable.from(

            // задача породила процесс
            // eslint-disable-next-line @typescript-eslint/unbound-method
            vscode.tasks.onDidStartTaskProcess(this.#processStartedHandler, this),

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
            // ----
            // Процесс(ы) задач(и) сдох(ли)
            // eslint-disable-next-line @typescript-eslint/unbound-method
            this.#monitor.onProcessesCompleted(this.#processCompletedHandler, this),

            // любой терминал закрылся
            // eslint-disable-next-line @typescript-eslint/unbound-method
            vscode.window.onDidCloseTerminal(this.#terminalClosedHandler, this),

            // наконец-то обновилось состояние терминалов (возможно - протухшее)
            // eslint-disable-next-line @typescript-eslint/unbound-method
            this.#terminals.onDidReconcile(this.#terminalsReconciledHandler, this),

            this.#monitor,
            this.#terminals,

            // эмиттер
            this.#onDidChange

        );
    }


    /** Cleanup: очистить все хранилища */
    dispose() {

        if (this.#disposed) {
            return;
        }

        this.#disposed = true;
        this.#disposable.dispose();

        // #region DEBUG
        log(LogLevel.Debug, 'Disposed', 'dispose');
        // #endregion DEBUG
    }

    // #endregion Lifecycle


    // #region Public

    /** Текущее состояние процессов задачи.
     *
     * @returns `undefined`, если задача не зарегистрирована или экземпляр disposed. */
    getProcessSummary(taskId: TaskId): Readonly<{
        total: number;
        running: number;
    }> | undefined {

        if (this.#disposed) {
            return undefined;
        }

        return this.#registry.summaryByTaskId(taskId);
    }


    /** Терминалы, связанные с процессами задачи.
     *
     * Собирает PID каждого открытого терминала и сопоставляет
     * с зарегистрированными процессами задачи.
     * Результат отсортирован по времени запуска (старые первыми).
     *
     * @returns Пустая `Map`, если задача не зарегистрирована. */
    async getTerminals(taskId: TaskId, cancellationToken: vscode.CancellationToken): Promise<ReadonlyMap<
        vscode.Terminal,
        Readonly<{
            readonly processId: ProcessId;
            readonly running: boolean;
            readonly timestamp: number;
            readonly taskId: TaskId;
        }>
    >> {

        if (this.#disposed) {
            return new Map();
        }

        const processes = this.#registry.getByTaskId(taskId);

        if (!processes || processes.size < 1) {
            return new Map();
        }

        return new Map(

            (await Promise.all(
                vscode.window.terminals.map(async (terminal) => {

                    const processId = await this.#terminals.getTerminalPid(terminal, cancellationToken);

                    if (!processId) {
                        return undefined;
                    }

                    if (!processes.has(processId)) {
                        return undefined;
                    }

                    return [terminal, { ...this.#registry.getByProcessId(processId), processId }] as const;
                })
            ))
                .filter((d): d is readonly [vscode.Terminal, ProcessRegistry.Process & { processId: ProcessId; }] => d != null)
                .sort((a, b) => a[1].timestamp - b[1].timestamp) // Старый в верху
        );

    }


    /** *Запрос* на остановку всех процессов задачи.
     *
     * Отправляет `SIGTERM` каждому живому процессу.
     * Мгновенная остановка, как и остановка вообще — не гарантируется.
     *
     * После dispose — no-op. */
    abortAll(taskId: TaskId): void {

        if (this.#disposed) {
            return;
        }

        const processes = this.#registry.getByTaskId(taskId);

        if (!processes || processes.size < 1) {
            // #region DEBUG
            log(LogLevel.Debug, 'Abort requested but no processes registered', EligibleTask.Id.print(taskId));
            // #endregion DEBUG
            return;
        }

        const running =
            [...processes]
                .filter((pid) => this.#registry.getByProcessId(pid)?.running);

        if (running.length < 1) {
            // #region DEBUG
            log(LogLevel.Debug, `Abort requested, but none running from ${processes.size} process(es) registered`, EligibleTask.Id.print(taskId));
            // #endregion DEBUG
            return;
        }

        // #region DEBUG
        log(LogLevel.Debug,
            `Aborting ${running.length} of ${processes.size} registered process(es)`, EligibleTask.Id.print(taskId));
        // #endregion DEBUG

        for (const processId of running) {
            this.#killProcess(processId);
        }
    }

    // #endregion Public


    // #region Handlers

    /** Обработка события запуска процесса задачи.
     * Регистрирует процесс, если PID валиден и задача в поддерживаемом scope,
     * затем инициирует пересмотр терминалов. */
    #processStartedHandler({ execution, processId }: vscode.TaskProcessStartEvent) {

        // #region DEBUG
        log(LogLevel.Trace, '"tasks.onDidStartTaskProcess" event received');
        log(LogLevel.Debug, `Task started with process "${processId}"`, execution.task.name);
        // #endregion DEBUG

        // начинаем следить, если "подходящая"
        if (isValidPid(processId)) { // сразу отбрасываем сломанное

            // "виртуальные" (без scope) и глобальные задачи будут пропущены
            if (EligibleTask.qualifies(execution.task)) {

                const taskId = EligibleTask.Id.from(execution.task);

                this.#registry.register(processId, taskId, Date.now());

                // #region DEBUG
                log(LogLevel.Debug, `Task process "${processId}" added to the registry`, EligibleTask.Id.print(taskId));
                // #endregion DEBUG

                this.#onDidChange.fire(taskId);

                this.#monitor.addTaskProcess(processId);

            }
            // #region DEBUG
            else {
                log(LogLevel.Warning, 'Task is beyond the scope, monitoring is skipped', execution.task.name);
            }
            // #endregion DEBUG
        }
        // #region DEBUG
        else {
            log(LogLevel.Warning, `Invalid PID received: "${processId}"`, execution.task.name);
        }
        // #endregion DEBUG

        // #region DEBUG
        log(LogLevel.Trace, 'Terminals reconciliation ...');
        // #endregion DEBUG

        // в любом случае — пересмотр терминалов
        this.#terminals.reconcile(Date.now());
    }


    /** Обработка завершённых процессов от {@linkcode Monitor}.
     * Помечает процессы как завершённые и инициирует пересмотр терминалов. */
    #processCompletedHandler(completed: ReadonlySet<ProcessId>) {

        // #region DEBUG
        log(LogLevel.Trace, '"monitor.onProcessesCompleted" event received');
        // #endregion DEBUG

        const ids = this.#registry.markCompleted([...completed]);

        if (ids.length > 0) {

            // #region DEBUG
            log(LogLevel.Debug, `Completed ${ids.length} process(es):`);
            // #endregion DEBUG

            for (const taskId of ids) {
                // #region DEBUG
                log(LogLevel.Debug, 'Marked as completed', EligibleTask.Id.print(taskId));
                // #endregion DEBUG


                this.#onDidChange.fire(taskId);
            }
        }

        // #region DEBUG
        log(LogLevel.Trace, 'Terminals reconciliation ...');
        // #endregion DEBUG

        // в любом случае — пересмотр терминалов
        this.#terminals.reconcile(Date.now());
    }


    /** Обработка закрытия любого терминала. Инициирует пересмотр всех терминалов. */
    #terminalClosedHandler(_terminal: vscode.Terminal) {

        // #region DEBUG
        log(LogLevel.Trace, '"window.onDidCloseTerminal" event received');
        // #endregion DEBUG

        // #region DEBUG
        log(LogLevel.Trace, 'Terminals reconciliation ...');
        // #endregion DEBUG

        this.#terminals.reconcile(Date.now());
        // @todo: для оптимизации тут можно проверять и удалять конкретный процесс,
        // а не проверять все терминалы.
        // Оставлю пока так для "а вдруг что-то пропускаю - почистит"

    }


    /** Обработка результата сверки терминалов от {@linkcode Terminals}.
     * Удаляет из реестра процессы, которых больше нет ни в одном терминале. */
    #terminalsReconciledHandler(snapshot: Terminals.Snapshot) {

        // #region DEBUG
        log(LogLevel.Trace,
            '"terminals.onDidReconcile" event received');
        // #endregion DEBUG

        const ids = this.#registry.reconcileSnapshot(snapshot);

        if (ids.length > 0) {

            // #region DEBUG
            log(LogLevel.Debug, `Unavailable ${ids.length} process(es):`);
            // #endregion DEBUG

            for (const taskId of ids) {

                // #region DEBUG
                log(LogLevel.Debug, 'Marked as unavailable', EligibleTask.Id.print(taskId));
                // #endregion DEBUG

                this.#onDidChange.fire(taskId);
            }
        }
    }

    // #endregion Handlers


    /** Отправка SIGTERM процессу.
     *
     * На Unix — сначала пытается убить группу процессов (`-pid`),
     * при неудаче — fallback на прямой kill.
     * На Windows — только прямой kill.
     *
     * ESRCH (процесс уже мёртв) — не ошибка. Прочие ошибки логируются,
     * но не пробрасываются — kill не фатален. */
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

                // #region DEBUG
                log(LogLevel.Trace, 'Group kill failed, falling back to direct kill', pid.toString());
                // #endregion DEBUG

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

            // #region DEBUG
            log(LogLevel.Warning, `Failed to kill process: ${error instanceof Error ? error.message : String(error)}`, pid.toString());
            // #endregion DEBUG

            // не фатально
            return;
        }
    }
}


/** Проверяет, является ли переданный PID валидным числом > 0.
 *
 * @remarks
 * VS Code не стесняется передавать как PID задачи — `undefined`
 *
 * @param pid - PID для проверки
 * @returns true если PID является валидным числом > 0, false иначе */
function isValidPid(pid: number | undefined): pid is ProcessId {
    return (pid !== undefined && /*Number.isInteger(pid) &&*/ pid > 0);
}

declare namespace Runtime {
    type ProcessStats = import('./ProcessRegistry.js').default.ProcessStats;
}

export default Runtime;
