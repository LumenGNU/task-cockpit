/** @file Cockpit/Runtime/index.ts */
/** @module Runtime */

import * as vscode from 'vscode';
import type * as TC from '../../types';
import EligibleTask from '../EligibleTask';
import Monitor from './Monitor';
import Terminals from './Terminals';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


/** Карта терминалов задачи: terminal → информация о процессе (включая PID).
 * Отсортирована по времени запуска (старые первыми). */
type TerminalsMap = ReadonlyMap<vscode.Terminal, TC.ProcessInfo & { processId: TC.ProcessId; }>;


/** Отслеживает жизненный цикл процессов, порождённых задачами VS Code.
 *
 * Реагирует на события запуска/завершения процессов и закрытия терминалов,
 * поддерживает реестр процессов с флагами `running`/завершён,
 * и уведомляет подписчиков об изменениях через {@linkcode onDidChange}.
 *
 * Процесс остаётся в реестре до тех пор, пока виден в терминале —
 * даже после завершения. */
export default class Runtime implements vscode.Disposable {

    private readonly changeEmitter: vscode.EventEmitter<TC.TaskId>;

    // #region Events

    /** Изменение состояния процессов.
     *
     * Срабатывает при любом изменении состояния процессов задачи:
     * запуск, завершение, удаление из реестра.
     *
     * Payload — идентификатор затронутой задачи. */
    public readonly onDidChange: vscode.Event<TC.TaskId>;

    // #endregion Events

    /** Реестр всех процессов по задачам, с их статусами
     *
     * Все процессы остаются здесь с флагами alive/dead,
     * пока видны в терминале.  */
    private readonly registry: Map<TC.TaskId, Map<TC.ProcessId, TC.ProcessInfo>>;

    private disposable: vscode.Disposable;

    /** {@link Monitor | Мониторинг процессов} */
    private readonly monitor: Monitor;

    /** {@link Terminals | Управление терминалами} */
    private readonly terminals: Terminals;

    private disposed: boolean;


    // #region Lifecycle

    constructor(runtimeSettings?: TC.RuntimeSettings) {

        this.disposed = false;

        this.registry = new Map<TC.TaskId, Map<TC.ProcessId, TC.ProcessInfo>>();

        this.changeEmitter = new vscode.EventEmitter<TC.TaskId>();
        this.onDidChange = this.changeEmitter.event;

        this.monitor = new Monitor(runtimeSettings?.pollingCap);
        this.terminals = new Terminals(runtimeSettings?.terminalTimeout);


        this.disposable = vscode.Disposable.from(

            // задача породила процесс
            vscode.tasks.onDidStartTaskProcess(this.processStartedHandler, this),

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
            this.monitor.onProcessesCompleted(this.processCompletedHandler, this),

            // любой терминал закрылся
            vscode.window.onDidCloseTerminal(this.terminalClosedHandler, this),

            // наконец-то обновилось состояние терминалов (возможно - протухшее)
            this.terminals.onDidReconcile(this.terminalsReconciledHandler, this),

            this.monitor,
            this.terminals,

            // эмиттер
            this.changeEmitter,

        );
    }


    /** Cleanup: очистить все хранилища */
    dispose() {

        this.disposed = true;

        this.disposable.dispose();

        this.registry.clear();

        // #region DEBUG
        log(LogLevel.Debug, 'Disposed', 'dispose');
        // #endregion DEBUG
    }

    // #endregion Lifecycle


    // #region Handlers

    /** Обработка события запуска процесса задачи.
     * Регистрирует процесс, если PID валиден и задача в поддерживаемом scope,
     * затем инициирует пересмотр терминалов. */
    private processStartedHandler({ execution, processId }: vscode.TaskProcessStartEvent) {

        // #region DEBUG
        log(LogLevel.Trace, '"tasks.onDidStartTaskProcess" event received');
        log(LogLevel.Debug, `Task started with process "${processId}"`, execution.task.name);
        // #endregion DEBUG

        // начинаем следить, если "подходящая"
        if (isValidPid(processId)) { // сразу отбрасываем сломанное

            // "виртуальные" (без scope) и глобальные задачи будут пропущены
            if (EligibleTask.qualifies(execution.task)) {

                const taskId = EligibleTask.Id.from(execution.task);

                this.addProcess(processId, taskId, Date.now());

                // #region DEBUG
                log(LogLevel.Debug, `Task process "${processId}" added to the registry`, EligibleTask.Id.print(taskId));
                // #endregion DEBUG

                this.changeEmitter.fire(taskId);

                this.monitor.addTaskProcess(processId);

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
        this.terminals.reconcile(Date.now());
    }


    /** Обработка завершённых процессов от {@linkcode Monitor}.
     * Помечает процессы как завершённые и инициирует пересмотр терминалов. */
    private processCompletedHandler(completed: ReadonlySet<TC.ProcessId>) {

        // #region DEBUG
        log(LogLevel.Trace, '"monitor.onProcessesCompleted" event received');
        // #endregion DEBUG

        const ids = this.markCompleted(new Set(completed));

        if (ids.size > 0) {

            // #region DEBUG
            log(LogLevel.Debug, `Completed ${ids.size} process(es):`);
            // #endregion DEBUG

            for (const taskId of ids) {
                // #region DEBUG
                log(LogLevel.Debug, 'Marked as completed', EligibleTask.Id.print(taskId));
                // #endregion DEBUG


                this.changeEmitter.fire(taskId);
            }
        }

        // #region DEBUG
        log(LogLevel.Trace, 'Terminals reconciliation ...');
        // #endregion DEBUG

        // в любом случае — пересмотр терминалов
        this.terminals.reconcile(Date.now());
    }


    /** Обработка закрытия любого терминала. Инициирует пересмотр всех терминалов. */
    private terminalClosedHandler(_terminal: vscode.Terminal) {

        // #region DEBUG
        log(LogLevel.Trace, '"window.onDidCloseTerminal" event received');
        // #endregion DEBUG

        // #region DEBUG
        log(LogLevel.Trace, 'Terminals reconciliation ...');
        // #endregion DEBUG

        this.terminals.reconcile(Date.now());
        // @todo: для оптимизации тут можно проверять и удалять конкретный процесс,
        // а не проверять все терминалы.
        // Оставлю пока так для "а вдруг что-то пропускаю - почистит"

    }


    /** Обработка результата сверки терминалов от {@linkcode Terminals}.
     * Удаляет из реестра процессы, которых больше нет ни в одном терминале. */
    private terminalsReconciledHandler(snapshot: TC.TerminalsSnapshot) {

        // #region DEBUG
        log(LogLevel.Trace,
            '"terminals.onDidReconcile" event received');
        // #endregion DEBUG

        const ids = this.removeUnavailableProcesses(snapshot);

        if (ids.size > 0) {

            // #region DEBUG
            log(LogLevel.Debug, `Unavailable ${ids.size} process(es):`);
            // #endregion DEBUG

            for (const taskId of ids) {

                // #region DEBUG
                log(LogLevel.Debug, 'Marked as unavailable', EligibleTask.Id.print(taskId));
                // #endregion DEBUG

                this.changeEmitter.fire(taskId);
            }
        }
    }

    // #endregion Handlers


    // #region Public

    /** Текущее состояние процессов задачи.
     *
     * Возвращает **живую ссылку** на внутренний `Map` — содержимое мутируется
     * при изменении состояния процессов. Не кешируй ссылку между циклами событий.
     *
     * @returns `undefined`, если задача не зарегистрирована или экземпляр disposed. */
    public state(taskId: TC.TaskId): TC.RuntimeState | undefined {

        if (this.disposed) {
            return undefined;
        }

        return this.registry.get(taskId);
    }


    /** Терминалы, связанные с процессами задачи.
     *
     * Собирает PID каждого открытого терминала и сопоставляет
     * с зарегистрированными процессами задачи.
     * Результат отсортирован по времени запуска (старые первыми).
     *
     * @returns Пустая `Map`, если задача не зарегистрирована. */
    public async getTerminals(taskId: TC.TaskId): Promise<TerminalsMap> {

        const stateInfo = this.registry.get(taskId);

        if (!stateInfo) {
            return new Map();
        }

        return new Map(
            (await Promise.all(
                vscode.window.terminals.map(async (terminal) => {
                    const processId = await this.terminals.getTerminalPid(terminal);

                    if (!processId) {
                        return undefined;
                    }

                    const processInfo = stateInfo.get(processId);

                    if (!processInfo) {
                        return undefined;
                    }

                    return [terminal, { ...processInfo, processId }] as const;
                })
            ))
                .filter((d): d is readonly [vscode.Terminal, TC.ProcessInfo & { processId: TC.ProcessId; }] => Boolean(d))
                .sort((a, b) => a[1].timestamp - b[1].timestamp) // Старый в верху
        );

    }


    /** *Запрос* на остановку всех процессов задачи.
     *
     * Отправляет `SIGTERM` каждому живому процессу.
     * Мгновенная остановка, как и остановка вообще — не гарантируется.
     *
     * После dispose — no-op. */
    public abortAll(taskId: TC.TaskId): void {

        if (this.disposed) {
            return;
        }

        const processes = this.registry.get(taskId);

        if (!processes || processes.size === 0) {
            // #region DEBUG
            log(LogLevel.Debug, 'Abort requested but no processes registered', EligibleTask.Id.print(taskId));
            // #endregion DEBUG
            return;
        }

        const runningProcesses = [...processes.entries()]
            .filter(([_, info]) => info.running)
            .map(([pid]) => pid);

        if (runningProcesses.length === 0) {
            // #region DEBUG
            log(LogLevel.Debug, `Abort requested, but none running from ${processes.size} process(es) registered`, EligibleTask.Id.print(taskId));
            // #endregion DEBUG
            return;
        }

        // #region DEBUG
        log(LogLevel.Debug,
            `Aborting ${runningProcesses.length} of ${processes.size} registered process(es)`, EligibleTask.Id.print(taskId));
        // #endregion DEBUG

        for (const processId of runningProcesses) {
            this.killProcess(processId);
        }
    }

    // #endregion Public


    /** Отправка SIGTERM процессу.
     *
     * На Unix — сначала пытается убить группу процессов (`-pid`),
     * при неудаче — fallback на прямой kill.
     * На Windows — только прямой kill.
     *
     * ESRCH (процесс уже мёртв) — не ошибка. Прочие ошибки логируются,
     * но не пробрасываются — kill не фатален. */
    private killProcess(pid: TC.ProcessId): void {
        try {

            // NO Win: попытка убить группу, fallback на сам процесс
            // Win: попытка убить только сам процесс
            try {
                if (process.platform === 'win32') {
                    process.kill(pid, 'SIGTERM');
                }
                else {
                    process.kill(-pid, 'SIGTERM');
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


    /** Регистрация нового процесса в реестре. Дубликаты игнорируются с предупреждением. */
    private addProcess(processId: TC.ProcessId, taskId: TC.TaskId, timestamp: number): void {

        let processes = this.registry.get(taskId);

        if (!processes) {
            processes = new Map();
            this.registry.set(taskId, processes);
        }

        if (processes.has(processId)) {
            // #region DEBUG
            log(LogLevel.Warning, `Duplicate process registration attempt: "${processId}"`, EligibleTask.Id.print(taskId));
            // #endregion DEBUG
            return;
        }

        processes.set(processId, {
            timestamp: timestamp,
            running: true,
        });

        // #region DEBUG
        log(LogLevel.Trace,
            `Registered process "${processId}" (total: ${processes.size})`, EligibleTask.Id.print(taskId));
        // #endregion DEBUG

        return;
    }


    /** Помечает процессы как завершённые (`running = false`).
     *
     * Мутирует входной `Set`, удаляя найденные PID для раннего выхода —
     * каждый PID уникален, повторных совпадений быть не может.
     *
     * @returns Множество задач, чьё состояние изменилось. */
    private markCompleted(completed: Set<TC.ProcessId>): ReadonlySet<TC.TaskId> {

        const changed = new Set<TC.TaskId>();

        for (const [taskId, processes] of this.registry) {

            for (const [processId, processInfo] of processes) {

                if (completed.has(processId)) {

                    processInfo.running = false;

                    changed.add(taskId);

                    // процесс - штука уникальная
                    // Значит: первое совпадение = единственное совпадение
                    completed.delete(processId);
                    if (completed.size < 1) {
                        break;
                    }
                }
            }

            if (completed.size < 1) {
                break;
            }

        }

        return changed;
    }


    /** Удаляет из реестра процессы, которых нет в снапшоте терминалов.
     *
     * Если снапшот старше процесса (`snapshot.timestamp < processInfo.timestamp`),
     * процесс пропускается — он появился после начала сбора снапшота.
     *
     * Пустые записи задач вычищаются из реестра.
     *
     * @returns Множество задач, чьё состояние изменилось. */
    private removeUnavailableProcesses(snapshot: TC.TerminalsSnapshot): ReadonlySet<TC.TaskId> {

        const changed = new Set<TC.TaskId>();

        for (const [taskId, processes] of this.registry) {

            for (const [processId, processInfo] of processes) {

                // снапшоты приходят по порядку и всегда актуальны, это условие — предохранитель.
                // Он гарантирует, что если процесс был добавлен после того, как VS Code
                // начал собирать данные для текущего снапшота, мы его не тронем.
                if (snapshot.timestamp < processInfo.timestamp) {

                    // пропуск возможного, неактуального для процесса снапшота

                    // #region DEBUG
                    log(LogLevel.Trace,
                        `Snapshot outdated for process "${processId}" (${snapshot.timestamp} < ${processInfo.timestamp}), skipping removal check`, EligibleTask.Id.print(taskId));
                    // continue;
                    // #endregion DEBUG

                    // @todo:
                    // Про break vs continue в removeInvisibleProcesses:
                    // Есть мнение что break — это не косяк, а отличная оптимизация. Поскольку:
                    // Map в JavaScript гарантирует порядок итерации в порядке вставки. -?
                    // Новые процессы добавляются в конец Map (в addProcess). -?
                    // logicalClock всегда растет.
                    // Следовательно, процессы внутри Map для конкретной задачи всегда
                    // отсортированы по времени (timestamp). Как только встречен первый процесс,
                    // который "моложе" снапшота (snapshot.timestamp < processInfo.timestamp),
                    // то можно быть уверенным, что все последующие процессы в этой задаче тоже моложе.
                    // Итог: break позволяет не проверять остальные процессы этой задачи, что
                    // эффективнее, чем continue.
                    // @fixme: Сейчас релизная версия использует break, но
                    // это не достаточно протестировано
                    break;
                }

                // если терминалы не "видят" этот процесс
                if (!snapshot.processIds.has(processId)) {

                    // удаление из реестра,
                    // #region DEBUG
                    log(LogLevel.Debug, `Task process "${processId}" has been removed from the registry (no longer available).`, EligibleTask.Id.print(taskId));
                    // #endregion DEBUG

                    processes.delete(processId);
                    changed.add(taskId);
                }
            }

            if (processes.size < 1) {
                //  очистка пустых
                // #region DEBUG
                log(LogLevel.Debug, `Task removed from registry (no processes left)`, EligibleTask.Id.print(taskId));
                // #endregion DEBUG

                this.registry.delete(taskId);
            }

        }

        return changed;

    }

}


/** Проверяет, является ли переданный PID валидным числом > 0.
 *
 * @remarks
 * VS Code не стесняется передавать как PID задачи — `undefined`
 *
 * @param pid - PID для проверки
 * @returns true если PID является валидным числом > 0, false иначе */
function isValidPid(pid: number | undefined): pid is TC.ProcessId {
    return (pid !== undefined && /*Number.isInteger(pid) &&*/ pid > 0);
}
