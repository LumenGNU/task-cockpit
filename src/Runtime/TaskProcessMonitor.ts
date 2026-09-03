/** @file Runtime/TaskProcessMonitor.ts */
/** @internal */

import {
    EventEmitter,
    LogOutputChannel
} from 'vscode';
import * as assert from 'node:assert/strict';
import WindowSettings from '../WindowSettings/WindowSettings';

import type {
    Disposable,
    Event,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    TaskProcessStartEvent
} from 'vscode';
import type LifecycleOmitted from '../utils/LifecycleOmitted';
import type TaskProcessId from './TaskProcessId';


type TaskProcessMonitorConfig = WindowSettings.Configuration[typeof TaskProcessMonitor.CONFIGURATION_SECTION];


/** Мониторинг процессов рантайм-задач VS Code (адаптивный интервал опроса).
 *
 * Класс для отслеживания состояния запущенных процессов задач VS Code.
 * Автоматически определяет завершившиеся процессы и уведомляет подписчиков.
 *
 * (не произвольные процессы ОС, а *процессы рантайм-задач* VS Code)
 *
 * Интервал проверки растёт по квадратичной формуле: `min + acceleration×n²` мс,
 * в зависимости от количества отслеживаемых процессов, но не более `cap` мс — что обеспечивает
 * баланс между отзывчивостью UI и нагрузкой на систему.
 *
 * @remarks
 * Использует `process.kill(pid, 0)` для проверки жизни процесса.
 *
 * */
class TaskProcessMonitor implements Disposable {

    static readonly CONFIGURATION_SECTION = 'TaskProcessMonitor' as const;
    #config: TaskProcessMonitorConfig;

    /** Событие: процесс(ы) рантайм-задачи завершился.
     * Вызывается при обнаружении завершенных процессов среди
     * отслеживаемых */
    readonly #onTaskProcessesCompleted: EventEmitter<ReadonlySet<TaskProcessId>>;

    public readonly onTaskProcessesCompleted: Event<ReadonlySet<TaskProcessId>>;

    readonly #taskProcessIds: Set<TaskProcessId>;

    /** Таймер следующей проверки процессов рантайм-задач.
     *
     * null когда мониторинг остановлен (нет активных процессов). */
    #checkTimeout: NodeJS.Timeout | null;

    #disposed: boolean;
    #disposables: Disposable[];

    #logOutputChannel: LifecycleOmitted<LogOutputChannel> | null;

    readonly #dependencies: Readonly<{
        windowSettings: LifecycleOmitted<WindowSettings>;
    }>;

    /** Создать экземпляр монитора. */
    constructor(
        dependencies: Readonly<{
            windowSettings: LifecycleOmitted<WindowSettings>;
        }>,
        logOutputChannel: LifecycleOmitted<LogOutputChannel> | null = null
    ) {

        this.#disposed = false;
        this.#logOutputChannel = logOutputChannel;

        this.#onTaskProcessesCompleted = new EventEmitter();
        this.onTaskProcessesCompleted = this.#onTaskProcessesCompleted.event;

        this.#disposables = [
            this.#onTaskProcessesCompleted
        ];

        this.#checkTimeout = null;
        this.#taskProcessIds = new Set();

        this.#dependencies = dependencies;

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.#dependencies.windowSettings.onDidCompleteUpdate(this.#handleConfigurationChange, this, this.#disposables);

        this.#config = this.#normalizePollingConfig(this.#dependencies.windowSettings.getConfiguration(TaskProcessMonitor.CONFIGURATION_SECTION));

    }


    /** Освободить ресурсы монитора.
     *
     * Останавливает все проверки, очищает события и набор идентификаторов процессов задач.
     *
     * @affects `checkTimeout` Таймер будет остановлен
     * @affects `taskProcessIds` Будет очищен  */
    public dispose() {
        if (this.#disposed) { return; }
        this.#disposed = true;

        this.#disposables.forEach((d) => void d.dispose());

        if (this.#checkTimeout) {
            clearTimeout(this.#checkTimeout);
            this.#checkTimeout = null;
        }

        this.#taskProcessIds.clear();

        this.#logOutputChannel?.trace(`[${this.constructor.name}] disposed`);
        this.#logOutputChannel = null;
    }


    // #region Handlers

    #handleConfigurationChange(affectedKeys: WindowSettings.AffectedKeys) {
        if (!affectedKeys.has(TaskProcessMonitor.CONFIGURATION_SECTION)) { return; }
        // Изменение конфигурации применится с задержкой — текущий интервал, если есть,
        // доработает с прошлыми параметрами. Новые вступят в силу только после
        // следующего срабатывания таймера.
        // @todo: если таймер активен, можно не ждать а перезапускать его с дельтою,
        // скорректировать оставшееся время.
        // Для этого нужно хранить метку запуска таймера и в applyConf вычислять
        // remaining = this.#nextCheckTime - Date.now(). (?? performance.now() ??)
        // Важность — Низкая. Пока просто ждем нового тика.
        this.#config = this.#normalizePollingConfig(this.#dependencies.windowSettings.getConfiguration(TaskProcessMonitor.CONFIGURATION_SECTION));
    }

    // #endregion Handlers


    // #region Public

    /** Добавить процесс рантайм-задачи в мониторинг.
     *
     * @param taskProcessId - идентификатор процесса рантайм-задачи из {@linkcode TaskProcessStartEvent}.
     *   {@linkcode TaskProcessMonitor} не делает предположений о природе этого процесса —
     *   его внутренняя иерархия вне зоны ответственности монитора.
     *
     * @affects
     * - Игнорирует дубликаты (если PID уже отслеживается)
     * - Запускает мониторинг если он был остановлен
     * - Не пересчитывает таймер, если проверка уже запланирована
     * */
    public addTaskProcessId(taskProcessId: TaskProcessId) {

        assert.ok(!this.#disposed, `[${this.constructor.name}#addTaskProcessId]: use after dispose`);

        this.#taskProcessIds.add(taskProcessId);

        // Не проверяем жив-ли процесс сразу — даем UI время
        // отдышаться — пусть он побудет какое-то время "живим" в UI
        // даже если моментально завершился.

        // Не пересчитываем интервал если таймаут уже работает.
        // Отзывчивость ui при массовом добавлении процессов: если таймер уже тикает, и прилетает
        // ещё 100 процессов, то не нужно сразу же пересчитывать интервал, — ближайшая проверка
        // пройдёт и scheduleCheck пересчитает интервал уже с новым count.
        if (!this.#checkTimeout) {
            this.#scheduleNextCheck();
        }
    }

    // #endregion Public


    // #region Private


    /** Запланировать следующую проверку процессов.
     *
     * Пересчитывает интервал на основе текущего количества отслеживаемых процессов.
     * Если процессов нет — мониторинг останавливается до добавления новых.
     *
     * */
    #scheduleNextCheck(): void {

        if (this.#disposed) { return; }

        assert.equal(this.#checkTimeout, null, `[${this.constructor.name}#scheduleNextCheck]: called with active timer — duplicate timer would be scheduled`);

        const timeoutMs = this.#calculatePollingIntervalMs();
        // если calculatePollingIntervalMs возвращает undefined (0 отслеживаемых
        // процессов) — останавливаемся.
        if (timeoutMs != null) {

            let checkTimeout: NodeJS.Timeout;

            // иначе планируем новый цикл-проверку через timeoutMs
            this.#checkTimeout = checkTimeout = setTimeout(() => {

                if (this.#disposed) { return; }
                if (checkTimeout !== this.#checkTimeout) { return; }
                this.#checkTimeout = null;

                const completed = this.#removeCompletedTaskProcessIds();

                if (completed.size > 0) {
                    this.#onTaskProcessesCompleted.fire(completed);
                }

                // кто-то мог вызвать addTaskProcessId в обработчик onTaskProcessesCompleted
                // кто-то мог вызвать dispose в обработчик onTaskProcessesCompleted
                // Проверка !this.#checkInterval гарантирует, что мы не создадим
                // второй таймер, если подписчик уже сделал это во время обработки события.
                if (this.#disposed || this.#checkTimeout) {
                    return;
                }

                // #scheduleNextCheck() вызывается только когда монитор не уничтожен и
                // таймер не активен.
                this.#scheduleNextCheck(); // и по новой, пока this.#processes.size > 0


            }, timeoutMs);
        }
    }


    /** Вычислить интервал опроса на основе количества отслеживаемых идентификаторов процессов задач.
     *
     * Формула: `polling.min + polling.acceleration × #processes.size²` мс, но не дольше `polling.cap` мс.
     *
     * @returns Интервал в миллисекундах, или `undefined` если нет процессов —
     *   что остановит опрос до появления новых процессов */
    #calculatePollingIntervalMs(): number | undefined {

        if (this.#taskProcessIds.size < 1) { return undefined; }

        const { min, acceleration, cap } = this.#config.polling;

        // При увеличении count: медленный рост вначале → резкое ускорение → cap
        return Math.min(min + acceleration * this.#taskProcessIds.size * this.#taskProcessIds.size, cap);
    }


    /** Проверить все отслеживаемые идентификаторы процессов рантайм-задач и удалить завершившиеся.
     *
     * Вызывается таймером согласно адаптивному интервалу.
     * Проверяет каждый Task Process ID через {@linkcode isTaskProcessAlive} и удаляет завершенные (и не доступные).
     *
     *  */
    #removeCompletedTaskProcessIds(): ReadonlySet<TaskProcessId> {

        const completedTaskProcessIds = new Set<TaskProcessId>();

        for (const taskProcessId of this.#taskProcessIds) {

            if (!isTaskProcessAlive(taskProcessId)) {
                this.#taskProcessIds.delete(taskProcessId); // Safe: Set allows delete during iteration
                completedTaskProcessIds.add(taskProcessId);
            }
        }

        return completedTaskProcessIds;
    }


    /** Нормализует и возвращает конфигурацию опроса.
     *
     * Нормализует конфигурацию polling: клампит cap относительно min
     * ~~~
     * polling.cap >= polling.min * 1.7
     * ~~~
     *
     * Смотри: src/WindowSettings/Schema.ts — границы и значения по умолчанию
     *
     * @param rawConfig
     *
     * */
    #normalizePollingConfig(rawConfig: TaskProcessMonitorConfig): TaskProcessMonitorConfig {

        // Clamp polling.cap >= polling.min * 1.7
        // Остальные значения и их границы должны проверятся
        // выше - на уровне конфигурации.

        return {
            polling: {
                min: rawConfig.polling.min,
                cap: Math.max(
                    rawConfig.polling.min * 1.7,
                    rawConfig.polling.cap
                ),
                acceleration: rawConfig.polling.acceleration
            }
        } as const;
    }
}

// #endregion


/** Проверить существование процесса рантайм-задачи.
 *
 * Использует `process.kill(pid, 0)` для проверки доступности процесса.
 *
 * @param taskProcessId идентификатор процесса рантайм-задачи
 * @returns true если процесс жив и доступен для проверки
 *
 *
 * Появление EPERM тут невозможно VS Code никогда не отдаст PID
 * процесса с чужим ruid (Linux).
 *
 * @todo ??? На Windows: VS Code запущен без elevation (Medium IL), задача через UAC порождает
 * elevated-процесс (High IL).
 * VS Code отдаёт этот PID в onDidStartTaskProcess → process.kill(pid, 0) → EPERM
 *
 * VS Code просто владеет терминалом, который сам создал. PID который выдаётся
 * в onDidStartTaskProcess — это процесс внутри терминала, которым VS Code
 * владеет как parent process через PTY.
 * (https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/tasks/browser/terminalTaskSystem.ts)
 *
 * @throws { never } */
function isTaskProcessAlive(taskProcessId: TaskProcessId): boolean {

    try {
        return process.kill(taskProcessId, 0);
    }
    catch (_error) { /* no-op */ }

    return false;
}


export default TaskProcessMonitor;
