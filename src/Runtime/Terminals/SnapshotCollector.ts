/** @file Runtime/Terminals/SnapshotCollector.ts */
/** @internal */

import {
    EventEmitter,
    LogOutputChannel
} from 'vscode';
import * as assert from 'node:assert/strict';
import collectTerminalProcessIds from './collectTerminalProcessIds';
import WindowSettings from '../../WindowSettings/WindowSettings';


import type {
    Disposable,
    Event
} from 'vscode';
import type Immutable from '../../utils/Immutable';
import type LifecycleOmitted from '../../utils/LifecycleOmitted';
import type RequestId from '../RequestId';
import type TerminalProcessesSnapshot from './TerminalProcessesSnapshot';


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

    static readonly CONFIGURATION_SECTION = 'Terminals';

    readonly #onDidCollectSnapshot: EventEmitter<Immutable<TerminalProcessesSnapshot>>;
    public readonly onDidCollectSnapshot: Event<Immutable<TerminalProcessesSnapshot>>;

    #configuration: WindowSettings.Configuration[typeof SnapshotCollector.CONFIGURATION_SECTION];

    #pendingId: RequestId | undefined;
    #running: boolean;

    #disposables: Disposable[];
    #disposed: boolean;

    readonly #dependencies: Readonly<{
        windowSettings: LifecycleOmitted<WindowSettings>;
    }>;

    #logOutputChannel: LifecycleOmitted<LogOutputChannel> | null;

    constructor(
        dependencies: Readonly<{
            windowSettings: LifecycleOmitted<WindowSettings>;
        }>,
        logOutputChannel: LifecycleOmitted<LogOutputChannel> | null = null
    ) {

        // подготовка очереди
        this.#pendingId = undefined;
        this.#running = false;

        this.#logOutputChannel = logOutputChannel;
        this.#dependencies = dependencies;

        this.#onDidCollectSnapshot = new EventEmitter<TerminalProcessesSnapshot>();
        this.onDidCollectSnapshot = this.#onDidCollectSnapshot.event;

        this.#disposed = false;
        this.#disposables = [
            this.#onDidCollectSnapshot
        ];

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.#dependencies.windowSettings.onDidCompleteUpdate(this.#handleConfigurationChange, this, this.#disposables);


        this.#configuration = this.#dependencies.windowSettings.getConfiguration(SnapshotCollector.CONFIGURATION_SECTION);
    }


    public dispose(): void {

        if (this.#disposed) { return; }
        this.#disposed = true;

        this.#disposables.forEach((d) => void d.dispose());

        // отмена очереди
        this.#pendingId = undefined;

        try {
            this.#logOutputChannel?.trace(`[${this.constructor.name}] disposed`);
        }
        catch { /* no-op */ }

        this.#logOutputChannel = null;
    }


    // #region Handlers

    #handleConfigurationChange(affectedKeys: WindowSettings.AffectedKeys) {
        if (!affectedKeys.has(SnapshotCollector.CONFIGURATION_SECTION)) { return; }
        this.#configuration = this.#dependencies.windowSettings.getConfiguration(SnapshotCollector.CONFIGURATION_SECTION);
    }

    // #endregion Handlers

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

        assert.ok(!this.#disposed, `[${this.constructor.name}#enqueueRequest]: use after dispose`);

        this.#pendingId = requestId;

        void this.#runLoop()
            .catch((error) => {
                // Этого не должно, и не будет происходить пока нижележащие
                // ф-ции выполняют свой контракт "@throws { never } Ничего и никогда"
                //
                // Следующий enqueueRequest запустит новый цикл,
                // но старый pending-запрос будет потерян (перезаписан новым),
                // либо, если нового не будет, зависнет навсегда.
                this.#logOutputChannel?.error(
                    `[${this.constructor.name}#enqueueRequest]: Unexpected error while collecting terminal process IDs for request ${requestId}`,
                    error
                );
                // Перебрасываем, чтобы привела к остановке выполнения.
                setImmediate(() => { throw error; });
            });
    }


    // #endregion Public

    // #region Private


    // #region Управление очередью


    /** Запускает цикл обработки очереди если есть ожидающий запрос
     * @throws { never } Ничего и никогда */
    async #runLoop(): Promise<void> {

        // Новые запросы во время выполнения активного
        // Если во время await collectTerminalProcessIds(...) приходит новый enqueueRequest,
        // он выставляет #pendingId, но #running в этот момент true,
        // поэтому повторный запуск #runLoop не происходит.
        // После завершения await цикл продолжает работу, проверяет условие while
        // и видит установленный #pendingId — цикл не выходит, а сразу обрабатывает новый запрос.
        // Если запрос приходит после finally, то #running уже false, и #runLoop из
        // enqueueRequest запускается нормально.

        if (this.#running) { return; }
        this.#running = true;

        try {

            while (this.#pendingId != null && !this.#disposed) {

                const requestId = this.#pendingId;
                this.#pendingId = undefined;

                const snapshot = await collectTerminalProcessIds(
                    requestId,
                    this.#configuration.timeout
                );

                if (!this.#disposed) {
                    // Если не disposed — эмитим
                    this.#onDidCollectSnapshot.fire(snapshot);
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
}


export default SnapshotCollector;
