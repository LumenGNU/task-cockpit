import {
    EventEmitter,
} from 'vscode';
import assert from 'node:assert/strict';
import type {
    Disposable,
    LogOutputChannel,
    Event,
} from 'vscode';
import type ScopeKey from '../ScopeKey';
import type TaskName from '../TaskName';
import type Immutable from '../utils/Immutable';
import type ProcessState from './ProcessState';
import type ProcessId from './ProcessId';
import type RequestId from './RequestId';
import type Safe from '../utils/Safe';
import type Timestamp from './Timestamp';


/** `Map<ProcessId, ProcessState>` — состояния всех процессов одной задачи. */
type TaskProcesses = Map<ProcessId, ProcessState>;


/** Полезная нагрузка события `onDidChangeTaskProcesses`:
 * область задач → имена задач, в которых изменилось состояние процессов. */
type EventPayload = Map<ScopeKey, Set<TaskName>>;


/** Публичный интерфейс реестра только для чтения.
 * Скрывает мутирующие методы оставляя только запросы и события. */
type ReadonlyProcessRegistry =
    Safe<Omit<ProcessRegistry, 'register' | 'markCompleted' | 'reconcile' | 'clear'>>;


/** Хранит сопоставления задача → рантайм-состояние её процессов.
 *
 * Внутри три взаимно синхронизированных индекса:
 * - `#processStateById` — первичный: `processId → ProcessState`
 * - `#processesByTask` — прямой: `scopeKey → taskName → Set<processId>`
 * - `#taskIdentifierById` — обратный: `processId → { scopeKey, taskName }`
 *
 * #### Управление:
 * - `register` — регистрация нового процесса в состоянии "выполняется"
 * - `markCompleted` — перевод процессов в состояние "выполнен"
 * - `reconcile` — удаление процессов, отсутствующих в системе
 * - `clear` — полная очистка реестра
 *
 * #### Запросы:
 * - `getState(scopeKey, taskName)` — состояния всех процессов задачи
 * - `disposed` — признак уничтоженного экземпляра
 *
 * #### Уведомления:
 * - `onDidChangeTaskProcesses` — изменилось состояние процессов;
 *   полезная нагрузка — `Map<ScopeKey, Set<TaskName>>` с затронутыми задачами
 * */
class ProcessRegistry implements Disposable {

    readonly #onDidChangeTaskProcesses: EventEmitter<Immutable<EventPayload>>;
    readonly onDidChangeTaskProcesses: Event<Immutable<EventPayload>>;

    readonly #onDidDisposed: EventEmitter<void>;
    readonly onDidDisposed: Event<void>;

    // Первичный индекс: processId → состояние процесса.
    readonly #processStateById: Map<ProcessId, ProcessState>;

    // Прямой индекс: scopeKey → taskName → множество processId.
    // Синхронизирован с #processStateById и #taskIdentifierById.
    readonly #processesByTask: Map<ScopeKey, Map<TaskName, Set<ProcessId>>>;

    // Обратный индекс: processId → идентификатор задачи.
    // Нужен для O(1)-определения владельца процесса при формировании
    // полезной нагрузки событий. Синхронизирован с двумя другими индексами.
    readonly #taskIdentifierById: Map<ProcessId, { readonly scopeKey: ScopeKey; readonly taskName: TaskName; }>;

    #logOutputChannel: Safe<LogOutputChannel> | null;

    readonly #disposables: Disposable[];
    #disposed: boolean;


    /**
     * @param logOutputChannel Канал для трассировки (необязателен).
     */
    constructor(
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {

        this.#disposed = false;

        this.#logOutputChannel = logOutputChannel;

        this.#onDidChangeTaskProcesses = new EventEmitter();
        this.onDidChangeTaskProcesses = this.#onDidChangeTaskProcesses.event;

        this.#onDidDisposed = new EventEmitter();
        this.onDidDisposed = this.#onDidDisposed.event;

        this.#processStateById = new Map();
        this.#processesByTask = new Map();
        this.#taskIdentifierById = new Map();

        this.#disposables = [
            this.#onDidChangeTaskProcesses,
            this.#onDidDisposed
        ];
    }


    /** Освобождает EventEmitter-ы и обнуляет канал логирования.
     * Повторный вызов — no-op. */
    dispose() {

        if (this.#disposed) {
            return;
        }

        this.#disposed = true;

        this.#onDidDisposed.fire();

        this.#disposables.forEach(function (d) {
            d.dispose();
        });

        this.#logOutputChannel?.trace(`${this.constructor.name}: disposed`);
        this.#logOutputChannel = null;
    }


    /** `true` после вызова `dispose()`. Вызов любого метода в этом состоянии — ошибка. */
    get disposed() {
        return this.#disposed;
    }


    /** Регистрирует один новый процесс задачи. Дубликат `processId` — ошибка.
     *
     * @param requestId Идентификатор запроса, породившего процесс.
     *   Сохраняется в `ProcessState.requestId` и используется
     *   `markCompleted` / `reconcile` для контроля порядка операций.
     * @param scopeKey Ключ области задач, которой принадлежит задача
     * @param taskName Имя задачи
     * @param processId Id регистрируемого процесса
     *
     * @fires onDidChangeTaskProcesses `Map { scopeKey → Set { taskName } }` */
    register(
        requestId: RequestId,
        scopeKey: ScopeKey,
        taskName: TaskName,
        processId: ProcessId,
    ): void {
        assert.equal(this.#disposed, false, `${this.constructor.name}#register: use after dispose`);
        assert.ok(!this.#processStateById.has(processId), `Duplicate process registration attempt: "${processId}" for ${taskName}`);

        const processState: ProcessState = {
            registerTimestamp: Date.now() as Timestamp,
            requestId,
            // Процесс всегда стартует в состоянии running — регистрация мёртвого
            // процесса не предусмотрена
            running: true,
        };

        this.#processStateById.set(processId, processState);

        let processesByTaskName = this.#processesByTask.get(scopeKey);
        if (!processesByTaskName) {
            processesByTaskName = new Map();
            this.#processesByTask.set(scopeKey, processesByTaskName);
        }
        let processIds = processesByTaskName.get(taskName);
        if (!processIds) {
            processIds = new Set();
            processesByTaskName.set(taskName, processIds);
        }
        processIds.add(processId);

        this.#taskIdentifierById.set(processId, { scopeKey, taskName });

        this.#onDidChangeTaskProcesses.fire(new Map([[scopeKey, new Set([taskName])]]));
    }


    /** Переводит указанные процессы в состояние "выполнен".
     * Принимает только зарегистрированные и работающие процессы.
     *
     * Завершение уже завершённого процесса — ошибка.
     * `requestId` должен быть строго больше, чем тот, с которым процесс
     * был в последний раз зарегистрирован или изменён.
     *
     * @param requestId Идентификатор запроса, фиксирующего завершение.
     *   Сохраняется в `ProcessState.requestId`.
     * @param processes Множество id завершившихся процессов
     *
     * @fires onDidChangeTaskProcesses `Map { scopeKey → Set { taskName } }` — задачи, затронутые изменением */
    markCompleted(
        requestId: RequestId,
        processes: ReadonlySet<ProcessId>,
    ): void {
        assert.equal(this.#disposed, false, `${this.constructor.name}#markCompleted: use after dispose`);

        const affectedByChanges: EventPayload = new Map();

        for (const processId of processes) {

            const processState = this.#processStateById.get(processId);

            assert.ok(processState, `${this.constructor.name}#markCompleted: unregistered process "${processId}"`);
            assert.equal(processState.running, true, `${this.constructor.name}#markCompleted: process "${processId}" is already completed`);
            // requestId монотонно возрастает — завершение с тем же или более старым
            // requestId нарушало бы порядок операций
            assert.ok(processState.requestId < requestId, `${this.constructor.name}#markCompleted: requestId(${requestId}) must be strictly greater than stored requestId(${processState.requestId}) for process "${processId}"`);

            processState.running = false;
            processState.requestId = requestId;

            const identifier = this.#taskIdentifierById.get(processId);

            // Инвариант: запись есть в #processStateById ↔ есть в #taskIdentifierById
            assert.ok(identifier, `${this.constructor.name}#markCompleted: processState exists but taskIdentifier missing for "${processId}" — indices out of sync`);

            let taskNames = affectedByChanges.get(identifier.scopeKey);
            if (!taskNames) {
                taskNames = new Set();
                affectedByChanges.set(identifier.scopeKey, taskNames);
            }
            taskNames.add(identifier.taskName);
        }

        this.#onDidChangeTaskProcesses.fire(affectedByChanges);

    }


    /** Удаляет из реестра процессы, которых больше нет в системе.
     * ("система" != "ОС")
     * ("больше нет" != "running: false")
     *
     * Снапшот — полный список процессов, реально присутствующих в системе
     * на момент `requestId`. Если процесса нет в снапшоте (а значит и в
     * системе), он удаляется из реестра.
     *
     * Исключение: записи, *изменённые после `requestId`*, пропускаются —
     * снапшот мог не застать ни регистрацию нового процесса,
     * ни завершение уже существующего.
     *
     * @param requestId Идентификатор запроса, которому соответствует снапшот.
     *   Записи с `processState.requestId > requestId` считаются "новее снапшота"
     *   и пропускаются.
     * @param ongoingProcesses Снимок состояния системы в момент `requestId`.
     *   Ожидается что снимок всегда полный (нет пропущенных процессов).
     *
     * @fires onDidChangeTaskProcesses `Map { scopeKey → Set { taskName } }` — задачи, затронутые удалением */
    // @todo (Важность низкая)
    // При большом количестве зарегистрированных процессов полный обход byId
    // может быть затратным.
    // Можно хранить максимальный requestId процессов, чтобы пропускать
    // итерацию, если снапшот старше всех процессов.
    reconcile(
        requestId: RequestId,
        ongoingProcesses: ReadonlySet<ProcessId>,
    ): void {
        assert.equal(this.#disposed, false, `${this.constructor.name}#reconcile: use after dispose`);

        const affectedByChanges: EventPayload = new Map();

        for (const [registeredProcess, processState] of this.#processStateById) {

            if (ongoingProcesses.has(registeredProcess)) {
                // этот процесс есть в системе
                continue;
            }

            if (requestId < processState.requestId) {
                // Запись новее снапшота: процесс был зарегистрирован или завершён
                // уже после того, как снапшот был собран — его отсутствие в нём ожидаемо
                continue; // @todo break? можно если есть гарантия что в processById порядок строго от requestId.
            }

            // Процесс отсутствует в снапшоте и не новее него —
            // вычищаем реестр, запоминая идентификаторы для уведомления

            const taskIdentifier = this.#taskIdentifierById.get(registeredProcess);

            assert.ok(taskIdentifier, `${this.constructor.name}#reconcile: process without task identifier "${registeredProcess}"`);

            // Полная очистка реестра: после удаления не должно остаться
            // "пустых" вложенных коллекций (Map/Set с size=0).
            this.#processStateById.delete(registeredProcess);
            this.#taskIdentifierById.delete(registeredProcess);

            const processesByTaskName = this.#processesByTask.get(taskIdentifier.scopeKey);
            assert.ok(processesByTaskName);
            const processIds = processesByTaskName.get(taskIdentifier.taskName);
            assert.ok(processIds);
            processIds.delete(registeredProcess);
            if (processIds.size < 1) {
                processesByTaskName.delete(taskIdentifier.taskName);
                if (processesByTaskName.size < 1) {
                    this.#processesByTask.delete(taskIdentifier.scopeKey);
                }
            }

            // запоминаем затронутый идентификатор для уведомления
            let affectedTaskNames = affectedByChanges.get(taskIdentifier.scopeKey);
            if (!affectedTaskNames) {
                affectedTaskNames = new Set();
                affectedByChanges.set(taskIdentifier.scopeKey, affectedTaskNames);
            }
            affectedTaskNames.add(taskIdentifier.taskName);
        }

        if (affectedByChanges.size > 0) {
            this.#onDidChangeTaskProcesses.fire(affectedByChanges);
        }
    }


    /** Полностью очищает реестр.
     * Уведомляет обо всех задачах, у которых были процессы.
     *
     * @fires onDidChangeTaskProcesses `Map { scopeKey → Set { taskName } }` — все задачи, бывшие в реестре */
    clear(): void {
        assert.equal(this.#disposed, false, `${this.constructor.name}#clear: use after dispose`);

        const affectedByChanges: EventPayload = new Map();

        // Итерируемся по плоскому обратному индексу #taskIdentifierById, а не по
        // двухуровневому #processesByTask — дешевле и проще. Set<TaskName>
        // в affectedByChanges автоматически дедуплицирует taskName, если у задачи
        // было несколько процессов.
        for (const { scopeKey, taskName } of this.#taskIdentifierById.values()) {
            let set = affectedByChanges.get(scopeKey);
            if (!set) {
                set = new Set();
                affectedByChanges.set(scopeKey, set);
            }
            set.add(taskName);
        }

        this.#taskIdentifierById.clear();
        this.#processStateById.clear();
        this.#processesByTask.clear();

        if (affectedByChanges.size > 0) {
            this.#onDidChangeTaskProcesses.fire(affectedByChanges);
        }
    }


    /** Возвращает снимок состояний всех процессов задачи.
     *
     * @returns Новая `Map<ProcessId, ProcessState>` — снимок состояний.
     *   `undefined`, если у задачи нет процессов в реестре.
     */
    getState(
        scopeKey: ScopeKey,
        taskName: TaskName
    ): Immutable<TaskProcesses> | undefined {
        assert.equal(this.#disposed, false, `${this.constructor.name}#getState: use after dispose`);

        const processesByTaskName = this.#processesByTask.get(scopeKey);
        if (!processesByTaskName) {
            return undefined;
        }
        const processes = processesByTaskName.get(taskName);
        if (!processes) {
            return undefined;
        }
        assert.ok(processes.size > 0, `${this.constructor.name}#getState invariant violated: entry exists but set is empty`);

        const result: TaskProcesses = new Map();

        for (const processId of processes) {
            const processState = this.#processStateById.get(processId);
            assert.ok(processState);
            result.set(processId, processState);
        }

        return result;
    }

}


export {
    ReadonlyProcessRegistry,
    ProcessRegistry
};
