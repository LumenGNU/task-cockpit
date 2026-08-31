/** @file Runtime/TaskProcessRegistry.ts */
/** @internal */

import {
    EventEmitter,
} from 'vscode';
import * as assert from 'node:assert/strict';

import type {
    Disposable,
    LogOutputChannel,
    Event,
} from 'vscode';
import type Immutable from '../utils/Immutable';
import type LifecycleOmitted from '../utils/LifecycleOmitted';
import type OriginKey from '../OriginKey';
import type TaskProcessId from './TaskProcessId';
import type ProcessState from './ProcessState';
import type RequestId from './RequestId';
import type TaskName from '../TaskName';
import type Timestamp from './Timestamp';


/** Карта состояния всех процессов одной задачи. */
type TaskProcesses = Map<TaskProcessId, ProcessState>;


/** Полезная нагрузка события `onDidChangeTaskProcesses`:
 * область происхождения → имена задач, в которых изменилось состояние процессов. */
type AffectedTasks = Map<OriginKey, Set<TaskName>>;


/** Хранит сопоставления задача → рантайм-состояние её процессов.
 *
 * Внутри три взаимно синхронизированных индекса:
 * - `#processStateById` — первичный: `processId → ProcessState`
 * - `#processesByTask` — прямой: `originKey → taskName → Set<processId>`
 * - `#taskIdentifierById` — обратный: `processId → { originKey, taskName }`
 *
 * #### Управление:
 * - `register` — регистрация нового процесса задачи в состоянии "выполняется"
 * - `markCompleted` — перевод процессов в состояние "выполнен"
 * - `reconcile` — удаление процессов, отсутствующих в системе
 *
 * #### Запросы:
 * - `getTaskProcessStates(originKey, taskName)` — состояния всех процессов задачи
 * - `disposed` — признак уничтоженного экземпляра
 *
 * #### Уведомления:
 * - `onDidChangeTaskProcesses` — изменилось состояние процессов;
 *   полезная нагрузка — `Map<originKey, Set<TaskName>>` с затронутыми задачами
 * */
class TaskProcessRegistry implements Disposable {

    readonly #onDidChangeTaskProcesses: EventEmitter<Immutable<AffectedTasks>>;
    readonly onDidChangeTaskProcesses: Event<Immutable<AffectedTasks>>;

    // Первичный индекс: processId → состояние процесса.
    readonly #processStateById: Map<TaskProcessId, ProcessState>;

    // Прямой индекс: область происхождения → имя задачи → множество идентификаторов процессов задачи.
    // Синхронизирован с #processStateById и #taskIdentifierById.
    readonly #processesByTask: Map<OriginKey, Map<TaskName, Set<TaskProcessId>>>;

    // Обратный индекс: processId → идентификатор задачи.
    // Нужен для O(1)-определения владельца процесса при формировании
    // полезной нагрузки событий. Синхронизирован с двумя другими индексами.
    readonly #taskIdentifierById: Map<TaskProcessId, { readonly originKey: OriginKey; readonly taskName: TaskName; }>;

    #logOutputChannel: LifecycleOmitted<LogOutputChannel> | null;

    readonly #disposables: Disposable[];
    #disposed: boolean;


    /**
     * @param logOutputChannel Канал для трассировки (необязателен).
     */
    constructor(
        logOutputChannel: LifecycleOmitted<LogOutputChannel> | null = null
    ) {

        this.#disposed = false;

        this.#logOutputChannel = logOutputChannel;

        this.#onDidChangeTaskProcesses = new EventEmitter();
        this.onDidChangeTaskProcesses = this.#onDidChangeTaskProcesses.event;

        this.#processStateById = new Map();
        this.#processesByTask = new Map();
        this.#taskIdentifierById = new Map();

        this.#disposables = [
            this.#onDidChangeTaskProcesses
        ];
    }


    /** Освобождает EventEmitter-ы и обнуляет канал логирования.
     * Повторный вызов — no-op. */
    dispose() {

        if (this.#disposed) { return; }
        this.#disposed = true;

        this.#disposables.forEach((d) => void d.dispose());

        this.#logOutputChannel?.trace(`[${this.constructor.name}] disposed`);
        this.#logOutputChannel = null;
    }


    /** `true` после вызова `dispose()`. Вызов любого метода в этом состоянии — ошибка. */
    get disposed(): boolean {
        return this.#disposed;
    }


    /** Регистрирует один новый процесс задачи. Дубликат `taskProcessId` — ошибка.
     *
     * @param requestId Идентификатор запроса, породившего процесс.
     *   Сохраняется в `ProcessState.requestId` и используется
     *   `markCompleted` / `reconcile` для контроля порядка операций.
     * @param originKey Ключ области происхождения задач, которой принадлежит задача
     * @param taskName Имя задачи
     * @param taskProcessId Id регистрируемого процесса
     *
     * @fires onDidChangeTaskProcesses `Map { originKey → Set { taskName } }` */
    register(
        requestId: RequestId,
        originKey: OriginKey,
        taskName: TaskName,
        taskProcessId: TaskProcessId,
    ): void {

        assert.ok(!this.#disposed, `[${this.constructor.name}#register]: use after dispose`);
        assert.ok(!this.#processStateById.has(taskProcessId), `Duplicate process registration attempt: "${taskProcessId}" for ${taskName}`);

        const processState: ProcessState = {
            registerTimestamp: Date.now() as Timestamp,
            requestId,
            // Процесс всегда стартует в состоянии running — регистрация мёртвого
            // процесса не предусмотрена
            running: true,
        };

        this.#processStateById.set(taskProcessId, processState);

        let processesByTaskName = this.#processesByTask.get(originKey);
        if (!processesByTaskName) {
            processesByTaskName = new Map();
            this.#processesByTask.set(originKey, processesByTaskName);
        }
        let processIds = processesByTaskName.get(taskName);
        if (!processIds) {
            processIds = new Set();
            processesByTaskName.set(taskName, processIds);
        }
        processIds.add(taskProcessId);

        this.#taskIdentifierById.set(taskProcessId, { originKey, taskName });

        this.#onDidChangeTaskProcesses.fire(new Map([[originKey, new Set([taskName])]]));
    }


    /** Помечает процессы с указанными идентификаторами как выполненные.
     *
     * Принимает только зарегистрированные идентификаторы работающих процессов.
     *
     * Завершение уже завершённого процесса — ошибка.
     * `requestId` должен быть строго больше, чем тот, с которым процесс
     * был в последний раз зарегистрирован или изменён.
     *
     * @param requestId Идентификатор запроса, фиксирующего завершение.
     *   Сохраняется в `ProcessState.requestId`.
     * @param taskProcessesIds Множество идентификаторов завершившихся процессов
     *
     * @fires onDidChangeTaskProcesses `Map { originKey → Set { taskName } }` — задачи, затронутые изменением */
    markCompleted(
        requestId: RequestId,
        taskProcessesIds: ReadonlySet<TaskProcessId>,
    ): void {

        assert.ok(!this.#disposed, `[${this.constructor.name}#markCompleted]: use after dispose`);

        assert.ok(taskProcessesIds.size > 0, `[${this.constructor.name}#markCompleted]: taskProcessesIds must not be empty`);

        const affectedByChanges: AffectedTasks = new Map();

        for (const processId of taskProcessesIds) {

            const processState = this.#processStateById.get(processId);

            // @todo такое случается. почему?
            // Потому что быстрая задача закрыла свой терминал, и reconcile отработал раньше чем
            // монитор процесса вызвал markCompleted.
            // assert.ok(processState, `[${this.constructor.name}#markCompleted]: unregistered process "${processId}"`);
            if (!processState) {
                continue;
            }

            assert.equal(processState.running, true, `[${this.constructor.name}#markCompleted]: process "${processId}" is already completed`);
            // requestId монотонно возрастает — завершение с тем же или более старым
            // requestId нарушало бы порядок операций
            assert.ok(processState.requestId < requestId, `[${this.constructor.name}#markCompleted]: requestId(${requestId}) must be strictly greater than stored requestId(${processState.requestId}) for process "${processId}"`);

            processState.running = false;
            processState.requestId = requestId;

            const identifier = this.#taskIdentifierById.get(processId);

            // Инвариант: запись есть в #processStateById ↔ есть в #taskIdentifierById
            assert.ok(identifier, `[${this.constructor.name}#markCompleted]: processState exists but taskIdentifier missing for "${processId}" — indices out of sync`);

            let taskNames = affectedByChanges.get(identifier.originKey);
            if (!taskNames) {
                taskNames = new Set();
                affectedByChanges.set(identifier.originKey, taskNames);
            }
            taskNames.add(identifier.taskName);
        }

        this.#onDidChangeTaskProcesses.fire(affectedByChanges);

    }


    /** Удаляет из реестра процессы, идентификаторов которых больше нет в системе.
     * ("система" != "ОС")
     * ("больше нет" != "running: false")
     *
     * Снимок — полный список процессов, идентификаторы которых реально присутствуют в системе
     * на момент `requestId`. Если процесса нет в снимке (а значит и в
     * системе), он удаляется из реестра.
     *
     * Исключение: записи, *изменённые после `requestId`*, пропускаются —
     * снимок мог не застать ни регистрацию нового процесса,
     * ни завершение уже существующего.
     *
     * @param requestId Идентификатор запроса, которому соответствует снимок.
     *   Записи с `processState.requestId > requestId` считаются "новее снимка"
     *   и пропускаются.
     * @param ongoingProcesses Снимок состояния системы в момент `requestId`.
     *   Ожидается что снимок всегда полный (нет пропущенных процессов).
     *
     * @fires onDidChangeTaskProcesses `Map { originKey → Set { taskName } }` — задачи, затронутые удалением */
    // @todo (Важность низкая)
    // При большом количестве зарегистрированных процессов полный обход byId
    // может быть затратным.
    // Можно хранить максимальный requestId процессов, чтобы пропускать
    // итерацию, если снапшот старше всех процессов.
    reconcile(
        requestId: RequestId,
        ongoingProcesses: ReadonlySet<TaskProcessId>,
    ): void {
        assert.ok(!this.#disposed, `[${this.constructor.name}#reconcile]: use after dispose`);

        const affectedByChanges: AffectedTasks = new Map();

        for (const [registeredProcess, processState] of this.#processStateById) {

            if (ongoingProcesses.has(registeredProcess)) {
                // этот процесс есть в системе
                continue;
            }

            if (requestId < processState.requestId) {
                // Запись новее снимка: процесс был зарегистрирован или завершён
                // уже после того, как снимок был собран — его отсутствие в нём ожидаемо
                continue; // @todo break? можно если есть гарантия что в #processStateById порядок строго от requestId.
            }

            // Процесс отсутствует в снимке и не новее него —
            // вычищаем реестр, запоминая идентификаторы для уведомления

            const taskIdentifier = this.#taskIdentifierById.get(registeredProcess);

            assert.ok(taskIdentifier, `[${this.constructor.name}#reconcile]: process without task identifier "${registeredProcess}"`);

            // Полная очистка реестра: после удаления не должно остаться
            // "пустых" вложенных коллекций (Map/Set с size=0).
            this.#processStateById.delete(registeredProcess);
            this.#taskIdentifierById.delete(registeredProcess);

            const processesByTaskName = this.#processesByTask.get(taskIdentifier.originKey);
            assert.ok(processesByTaskName);
            const processIds = processesByTaskName.get(taskIdentifier.taskName);
            assert.ok(processIds);
            processIds.delete(registeredProcess);
            if (processIds.size < 1) {
                processesByTaskName.delete(taskIdentifier.taskName);
                if (processesByTaskName.size < 1) {
                    this.#processesByTask.delete(taskIdentifier.originKey);
                }
            }

            // запоминаем затронутый идентификатор для уведомления
            let affectedTaskNames = affectedByChanges.get(taskIdentifier.originKey);
            if (!affectedTaskNames) {
                affectedTaskNames = new Set();
                affectedByChanges.set(taskIdentifier.originKey, affectedTaskNames);
            }
            affectedTaskNames.add(taskIdentifier.taskName);
        }

        if (affectedByChanges.size > 0) {
            this.#onDidChangeTaskProcesses.fire(affectedByChanges);
        }
    }


    /** Возвращает состояния всех процессов задачи.
     *
     * Возвращаемая Map создаётся заново при каждом вызове;
     * значения (`ProcessState`) — живые ссылки на внутренние объекты реестра,
     * актуальные на момент обращения.
     *
     * @param originKey Ключ области происхождения задачи
     * @param taskName Имя задачи
     * @returns Новая `Map<TaskProcessId, ProcessState>` с текущими состояниями,
     *   либо `undefined` если у задачи нет записей в реестре.
     */
    getTaskProcessStates(
        originKey: OriginKey,
        taskName: TaskName
    ): Immutable<TaskProcesses> | undefined {

        assert.ok(!this.#disposed, `[${this.constructor.name}#getTaskProcessStates]: use after dispose`);

        const processesByTaskName = this.#processesByTask.get(originKey);
        if (!processesByTaskName) {
            return undefined;
        }
        const processes = processesByTaskName.get(taskName);
        if (!processes) {
            return undefined;
        }
        assert.ok(processes.size > 0, `[${this.constructor.name}#getTaskProcessStates]: invariant violated: entry exists but set is empty`);

        const result: TaskProcesses = new Map();

        for (const processId of processes) {
            const processState = this.#processStateById.get(processId);
            assert.ok(processState);
            result.set(processId, processState);
        }

        return result;
    }

}


export default TaskProcessRegistry;
