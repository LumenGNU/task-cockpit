/** @file Cockpit/Runtime/Monitor.ts */
/** @module Monitor */

import * as vscode from 'vscode';
import type * as TC from '../types';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


/** Мониторинг процессов (адаптивный интервал опроса).
 *
 * Класс для отслеживания состояния запущенных процессов.
 * Автоматически определяет завершившиеся процессы и уведомляет подписчиков.
 *
 * Интервал проверки растёт по квадратичной формуле: POLL_MIN + 0.2×n² мс (cap {@linkcode pollCap} мс),
 * в зависимости от количества отслеживаемых процессов что обеспечивает
 * баланс между отзывчивостью UI и нагрузкой на систему.
 *
 * @remarks
 * Использует `process.kill(pid, 0)` для проверки жизни процесса.
 *
 * */
export default class Monitor implements vscode.Disposable {

    // #region Static

    // Константы
    // 322 - очень хорошее четное число из интервала 321..323
    /** Минимальный интервал опроса */
    private static readonly POLL_MIN = 322;
    /** Коэффициент замедления опроса при росте очереди.
     * Чем выше, тем быстрее мы достигаем {@linkcode pollCap}. */
    private static readonly POLL_ACCELERATION = 0.2;

    // #endregion Static

    private disposed: boolean;


    // #region Instance fields

    /** Событие: процесс задачи завершился.
     * Вызывается при обнаружении мёртвых процессов через `process.kill(pid, 0)`.  */
    private readonly completedEmitter: vscode.EventEmitter<ReadonlySet<TC.ProcessId>>;
    public readonly onProcessesCompleted: vscode.Event<ReadonlySet<TC.ProcessId>>;

    private readonly processes: Set<TC.ProcessId>;

    /** Максимальный интервал опроса (в мс). */
    private readonly pollCap: number;

    /** Таймер периодической проверки процессов.
     *
     * Undefined когда мониторинг остановлен (нет активных процессов). */
    private checkInterval: NodeJS.Timeout | undefined;

    // #endregion


    // #region Lifecycle

    /** Создать экземпляр монитора.
     * @param pollingCap - Максимальный интервал опроса (в мс). */
    constructor(pollingCap: number = 550) {

        this.disposed = false;

        this.completedEmitter = new vscode.EventEmitter<ReadonlySet<TC.ProcessId>>();
        this.onProcessesCompleted = this.completedEmitter.event;

        this.processes = new Set();

        // минимальный кап будет ~550 (поэтому и 1.7)
        this.pollCap = Math.max(Monitor.POLL_MIN * 1.7, pollingCap);
    }

    /** Освободить ресурсы монитора.
     *
     * Останавливает все проверки, очищает события и набор процессов.
     *
     * @affects `checkInterval` Таймер будет остановлен
     * @affects `processes` Будет очищен
     *
     * @implements {vscode.Disposable} */
    public dispose() {

        this.disposed = true;

        this.completedEmitter.dispose();

        if (this.checkInterval) {
            clearTimeout(this.checkInterval);
            this.checkInterval = undefined;
        }

        this.processes.clear();

        // #region DEBUG
        log(LogLevel.Debug,
            'disposed');
        // #endregion DEBUG

    }


    private ensureNotDisposed(): void {
        if (this.disposed) {
            throw new Error('Monitor: use after dispose');
        }
    }


    // #endregion Lifecycle


    // #region Public

    /** Получить отслеживаемые процессы.
     *
     * @remarks Между циклами опроса может содержать уже завершившиеся процессы.
     *
     * @remarks Живая структура, не копия
     * @returns Set процессов. (Readonly на уровне типов, рантайм — живой Set) */
    public getProcesses(): ReadonlySet<TC.ProcessId> {

        this.ensureNotDisposed();

        return this.processes;
    }


    /** Добавить процесс в мониторинг.
     *
     * @param processId - PID процесса для отслеживания
     *
     * @affects
     * - Игнорирует дубликаты (если PID уже отслеживается)
     * - Запускает мониторинг если он был остановлен
     * - Сохраняет текущий интервал проверки для быстрого отклика UI
     * */
    public addTaskProcess(processId: TC.ProcessId) {

        this.ensureNotDisposed();

        if (this.processes.has(processId)) {

            // #region DEBUG
            log(LogLevel.Warning,
                `Process is already tracked, skip it`,
                processId.toString());
            // #endregion DEBUG

            return;
        }

        // #region DEBUG
        log(LogLevel.Debug,
            `Added process to monitoring`,
            processId.toString());
        // #endregion DEBUG

        this.processes.add(processId);

        // Не проверяем жив-ли процесс сразу — даем UI время
        // отдышаться

        // Не пересчитываем интервал если таймаут уже работает.
        // Буст ui пры массовом добавлении процессов: если таймер уже тикает, и прилетает
        // ещё 100 процессов, то не нужно сразу же пересчитывать интервал, — ближайшая проверка
        // пройдёт быстро, а scheduleCheck пересчитает интервал уже с новым count.
        if (!this.checkInterval) {

            // #region DEBUG
            log(LogLevel.Trace,
                'Starting monitoring');
            // #endregion DEBUG

            this.scheduleCheck();
        }
    }

    // #endregion Public


    // #region Private implementation

    /** Проверить существование процесса.
     *
     * Использует `process.kill(pid, 0)` для проверки доступности процесса.
     *
     * @param processId - PID процесса
     * @returns true если процесс жив и доступен для проверки
     *
     * @remarks
     * Обработка ошибок:
     * - ESRCH → процесс не существует (мёртв) → false
     * - Любая другая ошибка (включая EPERM) → неожиданная ситуация,
     *   процесс исключается из мониторинга (return false).
     *
     * EPERM теоретически означает "процесс жив, но нет прав на проверку".
     * В контексте *процесса задачи* VS Code этого не должно происходить —
     * мы проверяем только дочерние процессы терминалов, запущенных самим VS Code.
     * Появление EPERM сигнализирует о нештатной ситуации (чужой PID в карте,
     * изменение прав, race condition). Продолжать мониторинг невалидируемого
     * процесса бессмысленно. */
    private isAlive(processId: TC.ProcessId): boolean {

        try {
            process.kill(processId, 0);
            return true;
        }
        catch (error) {

            if (error instanceof Error && 'code' in error && error.code === 'ESRCH') {
                return false;
            }

            // #region DEBUG
            // Логируем только не-ESRCH ошибки
            log(LogLevel.Error,
                `Unexpected error while checking process: ${JSON.stringify(error, null, 2)}`,
                processId.toString());
            // #endregion DEBUG

            return false;
        }
    }


    /** Запланировать следующую проверку процессов.
     *
     * Пересчитывает интервал на основе текущего количества процессов.
     * Если процессов нет — мониторинг останавливается до добавления новых.
     *
     * */
    private scheduleCheck() {

        if (this.checkInterval) {
            clearTimeout(this.checkInterval);
            this.checkInterval = undefined;
        }

        const timeout = this.pollingInterval(this.processes.size);

        if (timeout) {
            this.checkInterval = setTimeout(() => {
                this.pruneDead();
                this.scheduleCheck(); // и по новой, пока this.totalProcesses > 0
            }, timeout);

            // #region DEBUG
            log(LogLevel.Trace,
                `Next check in ${new Intl.NumberFormat(undefined, {
                    useGrouping: false,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(timeout)}ms for ${this.processes.size} processes`);
            // #endregion DEBUG

        }
        // #region DEBUG
        else {
            log(LogLevel.Trace,
                'No active processes, stopping monitoring');
        }
        // #endregion DEBUG
    }

    /** Вычислить интервал опроса на основе количества
     * отслеживаемых процессов.
     *
     * Для значений по умолчанию:
     * Формула: {@linkcode POLL_MIN} + {@linkcode POLL_ACCELERATION} × count² мс, но не более {@linkcode pollCap} мс.
     *
     * @returns Интервал в миллисекундах, или `undefined` если нет процессов
     *   (если `count < 1` что означает остановку мониторинга
     *   до появления новых процессов) */
    private pollingInterval(count: number): number | undefined {

        if (count < 1) {
            return undefined;
        }

        // Медленный рост вначале, резкое ускорение, cap на pollCap
        return Math.min(Monitor.POLL_MIN + Monitor.POLL_ACCELERATION * count * count, this.pollCap);
    }


    /** Проверить все отслеживаемые процессы и удалить завершившиеся.
     *
     * Вызывается таймером согласно адаптивному интервалу.
     * Проверяет каждый PID через {@linkcode isAlive} и удаляет мёртвые.
     *
     * @fires onProcessesCompleted — один раз с набором завершённых процессов (если есть).
     *
     *  */
    private pruneDead() {

        const completed = new Set<TC.ProcessId>();

        for (const processId of this.processes) {

            if (!this.isAlive(processId)) {

                // #region DEBUG
                log(LogLevel.Trace,
                    `Process is no longer running`,
                    processId.toString());
                // #endregion DEBUG

                this.processes.delete(processId); // Safe: Set allows delete during iteration
                completed.add(processId);
            }

        }

        if (completed.size > 0) {

            // #region DEBUG
            log(LogLevel.Debug,
                `${completed.size} process(es) finished, emitting notification`);
            // #endregion DEBUG

            this.completedEmitter.fire(completed);
        }
    }
}

// #endregion
