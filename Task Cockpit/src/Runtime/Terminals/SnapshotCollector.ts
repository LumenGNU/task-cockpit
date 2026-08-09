import {
    EventEmitter,
    LogOutputChannel,
    type Disposable,
    type Event,
    window,
} from 'vscode';
import * as assert from 'node:assert/strict';
import getProcessId from './getProcessId';
import type ProcessId from '../ProcessId';
import type Config from '../../WindowConfiguration/Config';
import type OngoingSnapshot from './OngoingSnapshot';
import type Safe from '../../utils/Safe';
import WindowConfiguration from './../../WindowConfiguration/WindowConfiguration';
import type Immutable from '../../utils/Immutable';
import type RequestId from '../RequestId';


const CONFIGURATION_KEY = 'Terminals';
type TerminalsConf = Config[typeof CONFIGURATION_KEY];


// Snapshot Dementia-based Event Machine (Latest-pending-wins mod)
/** Событийно-ориентированный сборщик атомарных снимков PID’ов
 * открытых терминалов VS Code.
 *
 * Возвращает атомарный снимок (snapshot) PID всех открытых терминалов.
 * Гарантирует целостность: либо все терминалы опрошены, либо запрос отменён (dispose).
 *
 * ## API
 *
 * ### Методы:
 * - `enqueueRequest(requestId)` — инициировать сбор PID, результат через событие
 * - `dispose()` — освободить ресурсы, отменить активные запросы
 *
 * ### События:
 * - `onDidCollectSnapshot` — snapshot готов
 *
 * ## Модель конкурентности
 *
 * Latest-wins execution queue с гарантией run-to-completion:
 * - Принимает запросы `enqueueRequest(requestId)`
 * - Выполняет не более одного запроса одновременно
 * - Новый запрос вытесняет ожидающий (pending), но никогда **не прерывает активный**
 * - Результат последнего запроса всегда будет обработан
 * - Результат всегда полный: либо snapshot собран полностью, либо запрос отменён (dispose)
 * - Результат отдаётся через событие `onDidCollectSnapshot`
 *
 * (Очередь запросов на сбор PID терминалов с вытеснением по последнему (Latest-wins))
 *
 * ## Важно
 *
 * - Кэширование запрещено — каждый вызов опрашивает API заново.
 * - `requestId` — непрозрачный идентификатор корреляции (correlation id).
 *   Просто число, которое приходит от вызывающего кода и возвращается
 *   ему же вместе с результатом.
 * - Терминал не ответивший за timeout считается терминалом без процесса (не ошибка).
 * - **Частичные результаты не возвращаются** — только полный snapshot (терминал, не ответивший
 *   за таймаут — это "терминал без PID").
 * - Событие `onDidCollectSnapshot` испускается только после успешного сбора всех PID.
 *
 * ## Заметки
 *
 * «Глючный» терминал увеличивает время сбора снапшота вплоть до `timeout`
 * а события `onDidCollectSnapshot` станут приходить c произвольной задержкой.
 *  */
class SnapshotCollector implements Disposable {

    readonly #onDidCollectSnapshot: EventEmitter<Immutable<OngoingSnapshot>>;
    public readonly onDidCollectSnapshot: Event<Immutable<OngoingSnapshot>>;

    #disposed: boolean;

    #conf: TerminalsConf;

    #pendingId: RequestId | undefined;
    #running: boolean;

    #disposables: Disposable[];

    readonly #windowConfiguration: Safe<WindowConfiguration>;
    #logOutputChannel: Safe<LogOutputChannel> | null;


    constructor(
        windowConfiguration: Safe<WindowConfiguration>,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {
        this.#disposed = false;
        this.#disposables = [];

        this.#logOutputChannel = logOutputChannel;

        // подготовка очереди
        this.#pendingId = undefined;
        this.#running = false;

        // conf ---
        this.#windowConfiguration = windowConfiguration;

        this.#disposables.push(
            this.#windowConfiguration.onDidChange((affectedKey) => {
                if (!affectedKey.has(CONFIGURATION_KEY)) {
                    return;
                }
                this.#conf = this.#windowConfiguration.getConfig(CONFIGURATION_KEY);
            })
        );
        this.#conf = this.#windowConfiguration.getConfig(CONFIGURATION_KEY);
        // ---

        this.#disposables.push(
            this.#onDidCollectSnapshot = new EventEmitter<OngoingSnapshot>()
        );
        this.onDidCollectSnapshot = this.#onDidCollectSnapshot.event;

    }


    public dispose(): void {

        if (this.#disposed) {
            return;
        }

        this.#disposed = true;
        this.#disposables.forEach(function (d) {
            d.dispose();
        });

        // отмена очереди
        this.#pendingId = undefined;

        this.#logOutputChannel?.trace(`${this.constructor.name}: disposed`);
        this.#logOutputChannel = null;
    }


    // #region Public


    /** Инициировать сбор PID всех открытых терминалов.
     *
     * Опрашивает каждый терминал с индивидуальным таймаутом.
     * Терминалы не ответившие вовремя исключаются из результата (считаются пустыми).
     * Результат приходит через событие `onDidCollectSnapshot`.
     *
     * При вызове во время выполнения предыдущего запроса:
     * - Активный запрос **продолжает выполняться до конца**
     * - Pending запрос (если был) молча вытесняется
     * - Новый запрос становится pending и выполнится после активного
     *
     * @param requestId Идентификатор запроса, задаваемый вызывающей стороной.
     *   Сборщик не проверяет и не интерпретирует это значение; оно будет
     *   скопировано в поле `Snapshot.requestId` результирующего снимка.
     *   Типичное использование: монотонно возрастающая временная метка,
     *   позволяющая потребителю игнорировать устаревшие результаты
     *   (непрозрачный идентификатор корреляции).
     *   Результаты отдаются строго в порядке завершения активных запросов,
     *   перестановки невозможны. Но возможен пропуск некоторых "промежуточных" запросов.
     *
     * @fire Terminals#onDidCollectSnapshot после успешного сбора всех PID */
    public enqueueRequest(requestId: RequestId): void {

        assert.equal(this.#disposed, false, 'SnapshotCollector: use after dispose');

        this.#pendingId = requestId;

        if (!this.#running) {
            this.#running = true;
            void this.#runLoop();
        }
    }


    // #endregion Public

    // #region Private


    // #region Управление очередью


    /** Запускает цикл обработки очереди если есть ожидающий запрос
     * @throws { never } Ничего и никогда */
    async #runLoop(): Promise<void> {

        try {
            while (this.#pendingId != null && !this.#disposed) {

                const requestId = this.#pendingId;
                this.#pendingId = undefined;

                try {

                    const snapshot = await SnapshotCollector.#collectProcessIds(
                        requestId,
                        this.#conf.timeout,
                    );

                    if (!this.#disposed) {
                        // Если не disposed — эмитим
                        this.#onDidCollectSnapshot.fire(snapshot);
                    }
                }
                catch (error) {
                    // Нарушение контракта! Защищаться нельзя — исправлять.
                    this.#logOutputChannel?.error(
                        `SnapshotCollector: an unexpected exception in #collectProcessIds, errorType=${error?.constructor?.name ?? typeof error}`
                    );

                    continue;
                }

                // цикл продолжится, если за время выполнения появился новый pendingId
            }
        }
        finally {
            // нет ожидающего или disposed
            this.#running = false;
        }
    }

    // #endregion Управление очередью


    // #region Резолвинг

    /** Собирает PID’ы терминалов через параллельный
     * запуск getProcessId для каждого терминал.
     * @returns Снапшот, содержащий только валидные PID процессов терминалов. */
    static async #collectProcessIds(
        requestId: RequestId,
        timeoutMs: number,
    ): Promise<Readonly<OngoingSnapshot>> {


        const terminals = window.terminals;

        if (terminals.length === 0) {
            return { requestId, ongoingProcesses: new Set() };
        }

        // Запускаем опрос.

        const results = await Promise.all(terminals.map(function (terminal) {
            // Гарантии:
            // - Пры любых проблемах возвращает `undefined`.
            // - По достижении timeout обязательно разрешится в `undefined`
            // - В остальных случаях вернет PID процесса терминала (number|undefined)
            return getProcessId(terminal, timeoutMs);
        }));

        return {
            requestId,
            ongoingProcesses: results.reduce(function (acc, processId) {
                // Фильтруем закрытые/зависшие/без процесса (undefined|null)
                if (processId != null) { acc.add(processId); }
                return acc;
            }, new Set<ProcessId>())
        };
    }



}


export default SnapshotCollector;
