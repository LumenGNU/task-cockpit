import {
    EventEmitter,
    LogOutputChannel,
    type Disposable,
    type Event
} from 'vscode';
import * as assert from 'node:assert/strict';
import type ProcessId from './ProcessId';
import type Config from '../Configuration/Window/Config';
import ConfigurationProvider from '../Configuration/ConfigurationProvider';


const CONFIGURATION_KEY = 'ProcessMonitorConf';
type ProcessMonitorConf = Config[typeof CONFIGURATION_KEY];


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
class ProcessMonitor implements Disposable {

    #disposed: boolean;

    /** Событие: процесс задачи завершился.
     * Вызывается при обнаружении мёртвых процессов  */
    readonly #onProcessesCompleted: EventEmitter<ReadonlySet<ProcessId>>;

    public readonly onProcessesCompleted: Event<ReadonlySet<ProcessId>>;

    readonly #processes: Set<ProcessId>;

    /** Таймер периодической проверки процессов.
     *
     * Undefined когда мониторинг остановлен (нет активных процессов). */
    #checkInterval: NodeJS.Timeout | undefined;
    #disposables: Disposable[];

    // #region Lifecycle

    #configuration: Readonly<ConfigurationProvider>;

    #conf: ProcessMonitorConf;


    /** Создать экземпляр монитора. */
    constructor(
        configuration: Readonly<ConfigurationProvider>,
        logOutputChannel: LogOutputChannel | null = null
    ) {
        this.#disposed = false;
        this.#disposables = [];


        this.#processes = new Set();

        // conf ---
        this.#configuration = configuration;

        this.#disposables.push(
            this.#configuration.onDidChange((affectedKey) => {
                if (!affectedKey.has(CONFIGURATION_KEY)) {
                    return;
                }
                this.#conf = this.#applyConf(this.#configuration.readWindowConfig(CONFIGURATION_KEY));
            })
        );
        this.#conf = this.#applyConf(this.#configuration.readWindowConfig(CONFIGURATION_KEY));
        // ---

        this.#disposables.push(
            this.#onProcessesCompleted = new EventEmitter<ReadonlySet<ProcessId>>()
        );
        this.onProcessesCompleted = this.#onProcessesCompleted.event;
    }


    // public static create(props: {
    //     conf: Readonly<ProcessMonitorConf>;
    //     logOutputChannel?: LogOutputChannel | null;
    // }): Readonly<ProcessMonitor> {
    //     const monitor = new ProcessMonitor(props.logOutputChannel);
    //     monitor.setConf(props.conf);
    //     return monitor;
    // }


    /** Освободить ресурсы монитора.
     *
     * Останавливает все проверки, очищает события и набор процессов.
     *
     * @affects `checkInterval` Таймер будет остановлен
     * @affects `processes` Будет очищен  */
    public dispose() {
        if (this.#disposed) {
            return;
        }
        this.#disposed = true;
        this.#disposables.forEach(function (d) {
            d.dispose();
        });

        if (this.#checkInterval) {
            clearTimeout(this.#checkInterval);
            this.#checkInterval = undefined;
        }

        this.#processes.clear();
    }


    // #endregion Lifecycle


    // #region Public


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

        assert.equal(this.#disposed, false, 'Monitor: use after dispose');

        if (this.#processes.has(processId)) {
            return;
        }

        this.#processes.add(processId);

        // Не проверяем жив-ли процесс сразу — даем UI время
        // отдышаться

        // Не пересчитываем интервал если таймаут уже работает.
        // Отзывчивость ui при массовом добавлении процессов: если таймер уже тикает, и прилетает
        // ещё 100 процессов, то не нужно сразу же пересчитывать интервал, — ближайшая проверка
        // пройдёт быстро, а scheduleCheck пересчитает интервал уже с новым count.
        if (!this.#checkInterval) {
            this.#scheduleCheck();
        }
    }

    // #endregion Public


    // #region Private


    /** Запланировать следующую проверку процессов.
     *
     * Пересчитывает интервал на основе текущего количества процессов.
     * Если процессов нет — мониторинг останавливается до добавления новых.
     *
     * */
    #scheduleCheck() {

        if (this.#checkInterval) {
            clearTimeout(this.#checkInterval);
            this.#checkInterval = undefined;
        }

        // dispose() мог быть вызван синхронно из listener'а onProcessesCompleted
        // пока выполнялся #pruneDead() в этом же тике таймера.
        if (this.#disposed) {
            return;
        }

        const timeout = this.#pollingInterval(this.#processes.size);

        if (timeout !== undefined) {

            this.#checkInterval = setTimeout(function (monitor) {
                monitor.#pruneDead();
                monitor.#scheduleCheck(); // и по новой, пока this.totalProcesses > 0
            }, timeout, this);
        }
    }


    /** Вычислить интервал опроса на основе количества
     * отслеживаемых процессов.
     *
     * Формула: `polling.min + polling.acceleration × count²` мс, но не более `polling.cap` мс.
     *
     * @returns Интервал в миллисекундах, или `undefined` если нет процессов
     *   (если `count < 1`) — что остановит опрос до появления новых процессов */
    #pollingInterval(count: number): number | undefined {

        if (count < 1) {
            return undefined;
        }

        const { min, acceleration, cap } = this.#conf.polling;

        // При увеличении count: медленный рост вначале → резкое ускорение → cap
        return Math.min(min + acceleration * count * count, cap);
    }


    /** Проверить все отслеживаемые процессы и удалить завершившиеся.
     *
     * Вызывается таймером согласно адаптивному интервалу.
     * Проверяет каждый PID через `#isAlive` и удаляет мёртвые.
     *
     * @fires onProcessesCompleted — один раз с набором завершённых процессов (если есть).
     *
     *  */
    #pruneDead() {

        if (this.#disposed) {
            return;
        }

        const completed = new Set<ProcessId>();

        for (const processId of this.#processes) {

            if (!this.#isAlive(processId)) {
                this.#processes.delete(processId); // Safe: Set allows delete during iteration
                completed.add(processId);
            }
        }

        if (completed.size > 0) {
            this.#onProcessesCompleted.fire(completed);
        }
    }

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
     * процесса бессмысленно. Процесс **для нас** мертв.
     *
     * @throws { never } */
    #isAlive(processId: ProcessId): boolean {

        try {
            process.kill(processId, 0);
            return true;
        }
        catch (_error) { /* no-op */ }

        return false;
    }

    /** Обновить конфигурацию опроса.
 *
 * Изменение конфигурации применится с задержкой — текущий интервал, если есть,
 * доработает с прошлыми параметрами. Новые вступят в силу только после
 * следующего срабатывания таймера.
 *
 * Clamp polling.cap >= polling.min * 1.7
 *
 * Смотри: src/Configuration/Global/SCHEMA.ts — границы и значения по умолчанию
 *
 * @param conf {@linkcode Conf} */
    // @todo: если таймер активен, можно не ждать а перезапускать его с дельтою,
    // скорректировать оставшееся время.
    // Для этого нужно хранить метку запуска таймера и в applyConf вычислять
    // remaining = this.#nextCheckTime - Date.now(). (?? performance.now() ??)
    // Важность — Низкая. Пока просто ждем нового тика.
    #applyConf(conf: Readonly<ProcessMonitorConf>): ProcessMonitorConf {

        // Clamp polling.cap >= polling.min * 1.7
        // Остальные значения и их границы должны проверятся
        // выше - на уровне конфигурации.

        return {
            polling: {
                min: conf.polling.min,
                cap: Math.max(
                    conf.polling.min * 1.7,
                    conf.polling.cap
                ),
                acceleration: conf.polling.acceleration
            }
        } as const;
    }
}

// #endregion


export default ProcessMonitor;
