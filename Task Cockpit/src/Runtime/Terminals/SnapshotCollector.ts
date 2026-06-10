import {
    CancellationError,
    CancellationToken,
    CancellationTokenSource,
    EventEmitter,
    LogOutputChannel,
    type Disposable,
    type Event,
    window,
} from 'vscode';
import * as assert from 'node:assert/strict';
import getProcessId from './getProcessId';
import type ProcessId from '../ProcessId';
import type Props from '../Props';
import type Snapshot from './Snapshot';


// Snapshot Dementia-based Event Machine (Latest-wins mod)
/** Событийно-ориентированный сборщик атомарных снимков PID’ов
 * открытых терминалов VS Code.
 *
 * Возвращает атомарный снимок (snapshot) PID всех открытых терминалов.
 * Гарантирует целостность: либо все терминалы опрошены, либо запрос отменён.
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
 * - Результат всегда полный: либо snapshot собран полностью, либо запрос отменён (dispose/CancellationToken)
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
 * «Глючный» терминал увеличивает время сбора снапшота до `timeout`,
 * а события `onDidCollectSnapshot` станут приходить c произвольной задержкой.
 *  */
class SnapshotCollector implements Disposable {

    readonly #onDidCollectSnapshot: EventEmitter<Snapshot>;
    public readonly onDidCollectSnapshot: Event<Snapshot>;

    #disposed: boolean;

    #props: Readonly<Props['terminals']>;

    #pendingId: number | undefined;
    #running: boolean;
    #activeCancel: CancellationTokenSource | null;

    readonly #logOutputChannel: LogOutputChannel | null;

    constructor(
        props: Props['terminals'],
        logOutputChannel: LogOutputChannel | null = null
    ) {

        this.#disposed = false;
        this.#props = this.#setProps(props);

        this.#logOutputChannel = logOutputChannel;

        // подготовка очереди
        this.#pendingId = undefined;
        this.#running = false;
        this.#activeCancel = null;

        this.#onDidCollectSnapshot = new EventEmitter<Snapshot>();
        this.onDidCollectSnapshot = this.#onDidCollectSnapshot.event;

    }


    public dispose(): void {

        if (this.#disposed) {
            return;
        }

        this.#disposed = true;

        this.#onDidCollectSnapshot.dispose();

        // отмена очереди
        this.#pendingId = undefined;

        // Прерывание текущего запроса
        // Не dispose(), не = null. Ресурс принадлежит #runLoop он и
        // отвечает за жизненный цикл. Тут только прерывание работы
        this.#activeCancel?.cancel();
    }


    // #region Public

    /**
     * Текущие активные запросы доработают со старым таймаутом (или как попало - не важно).
     * Следующий снапшот будет обработан с новым значением. */
    public setProps(props: Readonly<Props['terminals']>) {

        assert.ok(!this.#disposed, 'SnapshotCollector: use after dispose');

        this.#props = this.#setProps(props);
    }


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
     *
     * @fire Terminals#onDidCollectSnapshot после успешного сбора всех PID */
    public enqueueRequest(requestId: number): void {

        assert.ok(!this.#disposed, 'SnapshotCollector: use after dispose');

        this.#pendingId = requestId;

        if (!this.#running) {
            this.#running = true;
            void this.#runLoop();
        }
    }


    // #endregion Public

    // #region Private

    #setProps(props: Readonly<Props['terminals']>): Readonly<Props['terminals']> {
        return { ...props };
    }


    // #region Управление очередью


    /** Запускает цикл обработки очереди если есть ожидающий запрос
     * @throws { never } Ничего и никогда */
    async #runLoop(): Promise<void> {

        try {
            while (this.#pendingId != null && !this.#disposed) {

                const requestId = this.#pendingId;
                this.#pendingId = undefined;

                const cancelSource = new CancellationTokenSource(); // локальная ссылка
                this.#activeCancel = cancelSource;                  // для dispose() чтобы cancel()


                try {

                    const snapshot = await SnapshotCollector.#collectProcessIds(
                        requestId,
                        this.#props.timeout,
                        cancelSource.token
                    );

                    if (!this.#disposed) {
                        // Если не disposed — эмитим
                        this.#onDidCollectSnapshot.fire(snapshot);
                    }
                }
                catch (error) {
                    // Ожидается только CancellationError отменой из dispose.
                    // Других ошибок согласно контракту getProcessId быть не должно.
                    if (!(error instanceof CancellationError)) {
                        // Нарушение контракта! Защищаться нельзя — исправлять.
                        this.#logOutputChannel?.error(
                            `SnapshotCollector: an unexpected exception in #collectProcessIds, errorType=${error?.constructor?.name ?? typeof error}`
                        );
                    }
                    continue;
                }
                finally {
                    cancelSource.dispose(); // локальная, независимо от dispose()
                    this.#activeCancel = null;
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
     * @returns Снапшот, содержащий только валидные PID процессов терминалов.
     * @throws { CancellationError } при отмене через token */
    static async #collectProcessIds(
        requestId: number,
        timeout: number,
        token: CancellationToken
    ): Promise<Readonly<Snapshot>> {

        if (token.isCancellationRequested) {
            throw new CancellationError();
        }

        const terminals = window.terminals;

        if (terminals.length === 0) {
            return { requestId, processIds: new Set() };
        }

        // Запускаем опрос.
        const results = await Promise.all(
            terminals.map(function (terminal) {
                // Гарантии:
                // - CancellationError бросается только при отмене через token.
                //   Других ошибок не бросает. Пры любых проблемах возвращает `undefined`.
                // - По достижении timeout обязательно разрешится в `undefined`
                // - В остальных случаях вернет PID процесса терминала (number|undefined)
                return getProcessId(terminal, timeout, token);
            })
        );

        if (token.isCancellationRequested) {
            throw new CancellationError();
        }

        return {
            requestId,
            processIds: results.reduce(function (acc, processId) {
                // Фильтруем закрытые/зависшие/без процесса (undefined|null)
                if (processId != null) { acc.add(processId); }
                return acc;
            }, new Set<ProcessId>())
        };
    }

    // #endregion

    // #endregion Private
}


export default SnapshotCollector;
