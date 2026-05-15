/** @file Cockpit/Runtime/Monitor.ts */
/** @module Monitor */


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


import * as vscode from 'vscode';
import type { ProcessId } from '../type.d/ProcessId';


declare namespace Monitor {

    export interface Settings {
        readonly polling: {
            /** Минимальный интервал опроса (в мс). */
            readonly min: number;
            /** Максимальный интервал опроса (в мс).
             * Ожидается что будет как минимум cap > min * 1.7
             * Не проверяется, проверка на стороне поставщика настроек.
             * see: src/Workspace/Settings.ts */
            readonly cap: number;
            /** Коэффициент замедления опроса при росте очереди.
             * Чем выше, тем быстрее мы достигаем `cap`. */
            readonly acceleration: number;
        };
    }

}

/** Мониторинг процессов (адаптивный интервал опроса).
 *
 * Класс для отслеживания состояния запущенных процессов.
 * Автоматически определяет завершившиеся процессы и уведомляет подписчиков.
 *
 * Интервал проверки растёт по квадратичной формуле: `min + acceleration×n²` мс,
 * в зависимости от количества отслеживаемых процессов, но не более `cap` мс — что обеспечивает
 * баланс между отзывчивостью UI и нагрузкой на систему.
 *
 * @remarks
 * Использует `process.kill(pid, 0)` для проверки жизни процесса.
 *
 * */
class Monitor implements vscode.Disposable {


    private disposed: boolean;

    /** Событие: процесс задачи завершился.
     * Вызывается при обнаружении мёртвых процессов через `process.kill(pid, 0)`.  */
    private readonly completedEmitter: vscode.EventEmitter<ReadonlySet<ProcessId>>;
    public readonly onProcessesCompleted: vscode.Event<ReadonlySet<ProcessId>>;

    private readonly processes: Set<ProcessId>;

    /** Таймер периодической проверки процессов.
     *
     * Undefined когда мониторинг остановлен (нет активных процессов). */
    private checkInterval: NodeJS.Timeout | undefined;

    #pollingCnf: Monitor.Settings['polling'];


    // #region Lifecycle

    /** Создать экземпляр монитора.
     * */
    constructor(settings: Monitor.Settings) {

        this.disposed = false;

        this.#pollingCnf = settings.polling;

        this.completedEmitter = new vscode.EventEmitter<ReadonlySet<ProcessId>>();
        this.onProcessesCompleted = this.completedEmitter.event;

        this.processes = new Set();

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
        log(LogLevel.Debug, 'disposed', 'Monitor');
        // #endregion DEBUG

    }

    /** Обновить конфигурацию опроса.
     *
     * Значения не валидируются — ответственность на вызывающей стороне.
     *
     * @param pollingCnf.min Минимальный интервал опроса (мс).
     * @param pollingCnf.cap Максимальный интервал опроса (мс). Инвариант: `cap > min × 1.7`.
     * @param pollingCnf.acceleration Коэффициент замедления при росте очереди.
     *   Чем выше — тем быстрее достигается `cap`.
     *
     * see: {@linkcode MonitorSettings} */
    public set polling(pollingCnf: Readonly<Monitor.Settings['polling']>) {
        this.#pollingCnf = pollingCnf;
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
    public getProcesses(): ReadonlySet<ProcessId> {

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
    public addTaskProcess(processId: ProcessId) {

        this.ensureNotDisposed();

        if (this.processes.has(processId)) {

            // #region DEBUG
            log(LogLevel.Warning, `Process is already tracked, skip it`, processId.toString());
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
        // Буст ui при массовом добавлении процессов: если таймер уже тикает, и прилетает
        // ещё 100 процессов, то не нужно сразу же пересчитывать интервал, — ближайшая проверка
        // пройдёт быстро, а scheduleCheck пересчитает интервал уже с новым count.
        if (!this.checkInterval) {

            // #region DEBUG
            log(LogLevel.Trace, 'Starting monitoring');
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
     * @param processId PID процесса
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
     * Появление EPERM сигнализирует о нештатной ситуации (чужой PID,
     * изменение прав, race condition). Продолжать мониторинг невалидируемого
     * процесса бессмысленно. */
    private isAlive(processId: ProcessId): boolean {

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
            clearTimeout(this.checkInterval); // @todo: при вызове из callback — таймер уже сработал? защита от параллельного вызова?
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
     * Формула: `polling.min + polling.acceleration × count²` мс, но не более `polling.cap` мс.
     *
     * @returns Интервал в миллисекундах, или `undefined` если нет процессов
     *   (если `count < 1`) — что остановит мониторинг до появления новых процессов */
    private pollingInterval(count: number): number | undefined {

        if (count < 1) {
            return undefined;
        }

        const { min, acceleration, cap } = this.#pollingCnf;

        // Медленный рост вначале, резкое ускорение, cap
        return Math.min(min + acceleration * count * count, cap);
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

        const completed = new Set<ProcessId>();

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


export default Monitor;
