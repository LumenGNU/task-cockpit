import {
    EventEmitter,
    LogOutputChannel,
    type Disposable,
    type Event
} from 'vscode';
import * as assert from 'node:assert/strict';
import WindowConfiguration from './../WindowConfiguration/WindowConfiguration';


import type ProcessId from './ProcessId';
import type Safe from '../utils/Safe';
import type Config from '../WindowConfiguration/Config';
import type Immutable from '../utils/Immutable';


const CONFIGURATION_KEY = 'ProcessMonitor';
type ProcessMonitorConf = Config[typeof CONFIGURATION_KEY];


/** Мониторинг процессов задач VS Code (адаптивный интервал опроса).
 *
 * Класс для отслеживания состояния запущенных процессов задач VS Code.
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

    /** Событие: процесс(ы) завершился.
     * Вызывается при обнаружении завершенных процессов среди
     * отслеживаемых */
    readonly #onProcessesCompleted: EventEmitter<ReadonlySet<ProcessId>>;

    public readonly onProcessesCompleted: Event<ReadonlySet<ProcessId>>;

    readonly #processes: Set<ProcessId>;

    /** Таймер периодической проверки процессов.
     *
     * Undefined когда мониторинг остановлен (нет активных процессов). */
    #checkInterval: NodeJS.Timeout | undefined;
    #disposables: Disposable[];

    // #region Lifecycle

    readonly #windowConfiguration: Safe<WindowConfiguration>;
    #logOutputChannel: Safe<LogOutputChannel> | null;

    #conf: ProcessMonitorConf;


    /** Создать экземпляр монитора. */
    constructor(
        windowConfiguration: Safe<WindowConfiguration>,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {
        this.#disposed = false;
        this.#disposables = [];

        this.#logOutputChannel = logOutputChannel;

        this.#processes = new Set();

        // conf ---
        this.#windowConfiguration = windowConfiguration;

        this.#disposables.push(
            this.#windowConfiguration.onDidChange((affectedKey) => {
                if (!affectedKey.has(CONFIGURATION_KEY)) {
                    return;
                }
                this.#conf = this.#applyConf(this.#windowConfiguration.getConfig(CONFIGURATION_KEY));
            })
        );
        this.#conf = this.#applyConf(this.#windowConfiguration.getConfig(CONFIGURATION_KEY));
        // ---

        this.#disposables.push(
            this.#onProcessesCompleted = new EventEmitter<ReadonlySet<ProcessId>>()
        );
        this.onProcessesCompleted = this.#onProcessesCompleted.event;
    }


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

        this.#logOutputChannel?.trace(`${this.constructor.name}: disposed`);
        this.#logOutputChannel = null;
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

        assert.equal(this.#disposed, false, `${this.constructor.name}#addTaskProcess: use after dispose`);

        this.#processes.add(processId);

        // Не проверяем жив-ли процесс сразу — даем UI время
        // отдышаться — он побудет какое-то время "живим" в UI
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

        assert.equal(this.#disposed, false, `${this.constructor.name}#scheduleCheck: use after dispose`);
        assert.equal(this.#checkInterval, undefined, `${this.constructor.name}#scheduleCheck: called with active timer — duplicate timer would be scheduled`);

        const timeoutMs = this.#pollingInterval();
        // если pollingInterval возвращает undefined (0 отслеживаемых
        // процессов) — останавливаемся.
        if (timeoutMs !== undefined) {
            // иначе планируем новый цикл-проверку через timeoutMs
            this.#checkInterval = setTimeout(() => {

                if (this.#disposed) {
                    return;
                }

                this.#checkInterval = undefined;

                const completed = this.#pruneDead();

                if (completed.size > 0) {
                    this.#onProcessesCompleted.fire(completed);
                }

                // кто-то мог вызвать addTaskProcess в обработчик onProcessesCompleted
                // кто-то мог вызвать dispose в обработчик onProcessesCompleted
                if (!this.#disposed && !this.#checkInterval) {
                    this.#scheduleCheck(); // и по новой, пока this.#processes.size > 0
                }


            }, timeoutMs);
        }
    }


    /** Вычислить интервал опроса на основе количества
     * отслеживаемых процессов.
     *
     * Формула: `polling.min + polling.acceleration × #processes.size` мс, но не дольше `polling.cap` мс.
     *
     * @returns Интервал в миллисекундах, или `undefined` если нет процессов —
     *   что остановит опрос до появления новых процессов */
    #pollingInterval(): number | undefined {

        if (this.#processes.size < 1) {
            return undefined;
        }

        const { min, acceleration, cap } = this.#conf.polling;

        // При увеличении count: медленный рост вначале → резкое ускорение → cap
        return Math.min(min + acceleration * this.#processes.size * this.#processes.size, cap);
    }


    /** Проверить все отслеживаемые процессы и удалить завершившиеся.
     *
     * Вызывается таймером согласно адаптивному интервалу.
     * Проверяет каждый PID через `#isAlive` и удаляет мёртвые.
     *
     * @fires onProcessesCompleted — один раз с набором завершённых процессов (если есть).
     *
     *  */
    #pruneDead(): ReadonlySet<ProcessId> {

        assert.equal(this.#disposed, false, `${this.constructor.name}#pruneDead: use after dispose`);

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
     * Смотри: src/WindowConfiguration/WindowConfigurationSchema.ts — границы и значения по умолчанию
     *
     * @param conf {@linkcode Conf} */
    // @todo: если таймер активен, можно не ждать а перезапускать его с дельтою,
    // скорректировать оставшееся время.
    // Для этого нужно хранить метку запуска таймера и в applyConf вычислять
    // remaining = this.#nextCheckTime - Date.now(). (?? performance.now() ??)
    // Важность — Низкая. Пока просто ждем нового тика.
    #applyConf(conf: Immutable<ProcessMonitorConf>): ProcessMonitorConf {

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
 * EPERM: "процесс задачи" = тот PID, который VS Code породила как задачу
 * (оболочка, реализующая PTY для команды). Именно этот PID
 * отслеживается и управляется монитором.
 *
 * - Для процесса задачи всегда доступны проверки через `kill(pid, 0)`.
 *   Ошибка EPERM здесь невозможна: оболочка принадлежит тому же пользователю,
 *   что и VS Code, и права на сигнал гарантированы.
 * - Внутренние дочерние процессы (например, `sleep`, `sudo`, `su`, `docker run`)
 *   не являются "процессами задачи" — это уже «дети» процесса задачи, и они не
 *   входят в модель мониторинга. Даже если они принадлежат другому пользователю
 *   и недоступны для сигналов, это не влияет на корректность работы —
 *   ProcessMonitor не посылает им сигналы.
 *
 * Таким образом, ProcessMonitor никогда не сталкивается с EPERM при проверке
 * процессов задач. Завершение задачи фиксируется по PID оболочки, а её
 * внутренности остаются вне зоны ответственности.
 *
 * EPERM не должно происходить — мы проверяем только **дочерние процессы задач**,
 * запущенных самим VS Code. VS Code никогда не передаст ProcessMonitor PID,
 * которым не владеет.
 *
 * Появление EPERM сигнализирует о нештатной ситуации (чужой PID,
 * изменение прав, race condition, антивирус, я х.з). Продолжать мониторинг
 * невалидируемого процесса бессмысленно. Процесс **для нас** мертв.
 *
 * @throws { never } */
function isAlive(processId: ProcessId): boolean {

    try {
        return process.kill(processId, 0);
    }
    catch (_error) { /* no-op */ }

    return false;
}


export default ProcessMonitor;
