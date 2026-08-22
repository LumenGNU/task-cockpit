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
    Event
} from 'vscode';
import type LifecycleOmitted from '../utils/LifecycleOmitted';
import type ProcessId from './ProcessId';


type ModuleConfig = WindowSettings.Configuration[typeof TaskProcessMonitor.CONFIGURATION_KEY];


/** Мониторинг процессов задач VS Code (адаптивный интервал опроса).
 *
 * Класс для отслеживания состояния запущенных процессов задач VS Code.
 * Автоматически определяет завершившиеся процессы и уведомляет подписчиков.
 *
 * (не произвольные процессы ОС, а процессы рантайм-задач VS Code)
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

    static readonly CONFIGURATION_KEY = 'ProcessMonitor' as const;
    #config: ModuleConfig;

    /** Событие: процесс(ы) завершился.
     * Вызывается при обнаружении завершенных процессов среди
     * отслеживаемых */
    readonly #onProcessesCompleted: EventEmitter<ReadonlySet<ProcessId>>;

    public readonly onProcessesCompleted: Event<ReadonlySet<ProcessId>>;

    readonly #processes: Set<ProcessId>;

    /** Таймер периодической проверки процессов.
     *
     * null когда мониторинг остановлен (нет активных процессов). */
    #checkInterval: NodeJS.Timeout | null;

    #disposed: boolean;
    #disposables: Disposable[];

    #logOutputChannel: LifecycleOmitted<LogOutputChannel> | null;

    readonly #dependencies: Readonly<{
        windowConfiguration: LifecycleOmitted<WindowSettings>;
    }>;

    /** Создать экземпляр монитора. */
    constructor(
        dependencies: Readonly<{
            windowConfiguration: LifecycleOmitted<WindowSettings>;
        }>,
        logOutputChannel: LifecycleOmitted<LogOutputChannel> | null = null
    ) {

        this.#disposed = false;
        this.#logOutputChannel = logOutputChannel;

        this.#onProcessesCompleted = new EventEmitter();
        this.onProcessesCompleted = this.#onProcessesCompleted.event;

        this.#disposables = [
            this.#onProcessesCompleted
        ];

        this.#checkInterval = null;
        this.#processes = new Set();

        this.#dependencies = dependencies;

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.#dependencies.windowConfiguration.onDidChangeConfiguration(this.#changeConfigurationHandler, this, this.#disposables);

        this.#config = this.#applyConf(this.#dependencies.windowConfiguration.getConfiguration(TaskProcessMonitor.CONFIGURATION_KEY));

    }


    /** Освободить ресурсы монитора.
     *
     * Останавливает все проверки, очищает события и набор процессов.
     *
     * @affects `checkInterval` Таймер будет остановлен
     * @affects `processes` Будет очищен  */
    public dispose() {
        if (this.#disposed) { return; }
        this.#disposed = true;

        this.#disposables.forEach((d) => void d.dispose());

        if (this.#checkInterval) {
            clearTimeout(this.#checkInterval);
            this.#checkInterval = null;
        }

        this.#processes.clear();

        this.#logOutputChannel?.trace(`[${this.constructor.name}]: disposed`);
        this.#logOutputChannel = null;
    }


    // #region Handlers

    #changeConfigurationHandler(affectedKey: WindowSettings.AffectedKeys) {
        if (!affectedKey.has(TaskProcessMonitor.CONFIGURATION_KEY)) { return; }
        this.#config = this.#applyConf(this.#dependencies.windowConfiguration.getConfiguration(TaskProcessMonitor.CONFIGURATION_KEY));
    }

    // #endregion Handlers


    // #region Public


    /** Добавить процесс в мониторинг.
     *
     * @param processId - PID процесса задачи из
     *   {@link vscode.TaskProcessStartEvent.processId}.
     *   ProcessMonitor не делает предположений о природе этого процесса —
     *   его внутренняя иерархия вне зоны ответственности монитора.
     *
     * @affects
     * - Игнорирует дубликаты (если PID уже отслеживается)
     * - Запускает мониторинг если он был остановлен
     * - Сохраняет текущий интервал проверки для быстрого отклика UI
     * */
    public addTaskProcess(processId: ProcessId) {

        if (this.#disposed) {
            assert.fail(`[${this.constructor.name}#addTaskProcess]: use after dispose`);
        }

        this.#processes.add(processId);

        // Не проверяем жив-ли процесс сразу — даем UI время
        // отдышаться — пусть он побудет какое-то время "живим" в UI
        // даже если моментально завершился.

        // Не пересчитываем интервал если таймаут уже работает.
        // Отзывчивость ui при массовом добавлении процессов: если таймер уже тикает, и прилетает
        // ещё 100 процессов, то не нужно сразу же пересчитывать интервал, — ближайшая проверка
        // пройдёт и scheduleCheck пересчитает интервал уже с новым count.
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
    #scheduleCheck(): void {

        if (this.#disposed) { return; }

        assert.equal(this.#checkInterval, null, `[${this.constructor.name}#scheduleCheck]: called with active timer — duplicate timer would be scheduled`);

        const timeoutMs = this.#pollingInterval();
        // если pollingInterval возвращает undefined (0 отслеживаемых
        // процессов) — останавливаемся.
        if (timeoutMs != null) {

            let checkInterval: NodeJS.Timeout;

            // иначе планируем новый цикл-проверку через timeoutMs
            this.#checkInterval = checkInterval = setTimeout(() => {

                if (this.#disposed) { return; }
                if (checkInterval !== this.#checkInterval) { return; }
                this.#checkInterval = null;

                const completed = this.#pruneDead();

                if (completed.size > 0) {
                    this.#onProcessesCompleted.fire(completed);
                }

                // кто-то мог вызвать addTaskProcess в обработчик onProcessesCompleted
                // кто-то мог вызвать dispose в обработчик onProcessesCompleted
                // Проверка !this.#checkInterval гарантирует, что мы не создадим
                // второй таймер, если подписчик уже сделал это во время обработки события.
                if (this.#disposed || this.#checkInterval) {
                    return;
                }

                // #scheduleCheck() вызывается только когда монитор не уничтожен и
                // таймер не активен.
                this.#scheduleCheck(); // и по новой, пока this.#processes.size > 0


            }, timeoutMs);
        }
    }


    /** Вычислить интервал опроса на основе количества
     * отслеживаемых процессов.
     *
     * Формула: `polling.min + polling.acceleration × #processes.size²` мс, но не дольше `polling.cap` мс.
     *
     * @returns Интервал в миллисекундах, или `undefined` если нет процессов —
     *   что остановит опрос до появления новых процессов */
    #pollingInterval(): number | undefined {

        if (this.#processes.size < 1) { return undefined; }

        const { min, acceleration, cap } = this.#config.polling;

        // При увеличении count: медленный рост вначале → резкое ускорение → cap
        return Math.min(min + acceleration * this.#processes.size * this.#processes.size, cap);
    }


    /** Проверить все отслеживаемые процессы и удалить завершившиеся.
     *
     * Вызывается таймером согласно адаптивному интервалу.
     * Проверяет каждый PID через `#isAlive` и удаляет завершенные (и не доступные).
     *
     * @fires onProcessesCompleted — один раз с набором завершённых процессов (если есть).
     *
     *  */
    #pruneDead(): ReadonlySet<ProcessId> {

        const completed = new Set<ProcessId>();

        for (const processId of this.#processes) {

            if (!isAlive(processId)) {
                this.#processes.delete(processId); // Safe: Set allows delete during iteration
                completed.add(processId);
            }
        }

        return completed;
    }


    /** Обновить конфигурацию опроса.
     *
     * Изменение конфигурации применится с задержкой — текущий интервал, если есть,
     * доработает с прошлыми параметрами. Новые вступят в силу только после
     * следующего срабатывания таймера.
     *
     * Clamp polling.cap >= polling.min * 1.7
     *
     * Смотри: src/WindowSettings/Schema.ts — границы и значения по умолчанию
     *
     * @param config
     *
     * */
    // @todo: если таймер активен, можно не ждать а перезапускать его с дельтою,
    // скорректировать оставшееся время.
    // Для этого нужно хранить метку запуска таймера и в applyConf вычислять
    // remaining = this.#nextCheckTime - Date.now(). (?? performance.now() ??)
    // Важность — Низкая. Пока просто ждем нового тика.
    #applyConf(config: ModuleConfig): ModuleConfig {

        // Clamp polling.cap >= polling.min * 1.7
        // Остальные значения и их границы должны проверятся
        // выше - на уровне конфигурации.

        return {
            polling: {
                min: config.polling.min,
                cap: Math.max(
                    config.polling.min * 1.7,
                    config.polling.cap
                ),
                acceleration: config.polling.acceleration
            }
        } as const;
    }
}

// #endregion


/** Проверить существование процесса рантайм-задачи.
 *
 * Использует `process.kill(pid, 0)` для проверки доступности процесса.
 *
 * @param processId PID процесса
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
function isAlive(processId: ProcessId): boolean {

    try {
        return process.kill(processId, 0);
    }
    catch (_error) { /* no-op */ }

    return false;
}


export default TaskProcessMonitor;
