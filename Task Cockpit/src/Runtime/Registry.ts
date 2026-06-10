import * as assert from 'node:assert/strict';
import type Process from './Process';
import type ProcessId from './ProcessId';
import type ScopeKey from '../Scope/Key';
import type Snapshot from './Terminals/Snapshot';
import type TaskIdentifier from './TaskIdentifier';
import type TaskName from '../type.d/TaskName';


export interface Stats {
    /** Общее количество процессов у задачи */
    total: number;
    /** Количество процессов задачи в состоянии выполнения */
    running: number;
}


/** Хранит сопоставления задача → рантайм-состояние её процессов.
 * Создаётся через {@link Registry.create}.
 *
 * #### Управление:
 * - `register` — регистрация нового процесса
 * - `markCompleted` — перевод процессов в состояние "выполнен"
 * - `reconcile` — удаление процессов, отсутствующих в снапшоте
 *
 * #### Запросы:
 * - `get` — снимок состояния процесса по его id
 * - `ProcessId.get` — id процессов, порождённых задачей
 * - `Stats.get` — агрегированная статистика по процессам задачи */
interface Registry {

    /** Регистрация нового процесса в реестре. Дубликаты — ошибка.
     *
     * @param taskIdentifier Идентификатор задачи, породившей процесс
     * @param processId Id регистрируемого процесса
     * @param timestamp Метка времени регистрации */
    register(taskIdentifier: Readonly<TaskIdentifier>, processId: ProcessId, timestamp: number): void;


    /** Переводит указанные процессы в состояние "выполнен".
     * Принимает только зарегистрированные процессы.
     *
     * @param processes Множество id завершившихся процессов
     * @returns Map от `ScopeKey` к множеству `TaskName` — задачи, затронутые изменением */
    markCompleted(processes: ReadonlySet<ProcessId>): ReadonlyMap<ScopeKey, ReadonlySet<TaskName>>;


    /** Удаляет из реестра процессы, которых нет в снапшоте.
     *
     * Снапшот — полный список процессов, реально присутствующих в системе
     * на момент `timestamp`. Если процесса нет в снапшоте (а значит и в
     * системе), он удаляется из реестра.
     *
     * Исключение: процессы, *зарегистрированные после `timestamp`*, пропускаются —
     * снапшот не успел их зафиксировать.
     *
     * @param snapshot Снимок состояния системы в момент времени.
     *   Ожидается что снимок всегда полный (нет пропущенных процессов).
     * @returns Map от `ScopeKey` к множеству `TaskName` — задачи, затронутые удалением */
    reconcile(snapshot: Readonly<Snapshot>): ReadonlyMap<ScopeKey, ReadonlySet<TaskName>>;

    clear(): void;

    // -----

    /** Возвращает снимок состояния процесса, или `undefined` если
     * процесс не зарегистрирован. */
    get(id: ProcessId): Readonly<Process> | undefined;


    /** Возвращает множество id процессов, порождённых указанной задачей,
     *  или `undefined` если задача не имеет зарегистрированных процессов. */
    readonly ProcessId: {
        get(scopeKey: ScopeKey): {
            get(taskName: TaskName): ReadonlySet<ProcessId> | undefined;
        } | undefined;
    };


    /** Возвращает агрегированную статистику по процессам задачи:
     *  общее количество и количество активных (`running: true`).
     *  `undefined` — задача не имеет зарегистрированных процессов. */
    readonly Stats: {
        get(scopeKey: ScopeKey): {
            get(taskName: TaskName): Readonly<Stats> | undefined;
        } | undefined;
    };

}


const Registry = {

    /** Создаёт новый изолированный экземпляр реестра процессов. */
    create(): Registry {

        // Основной индекс: processId → состояние процесса
        const processById = new Map<ProcessId, Process>();
        // Вторичный индекс: task → множество processId. Синхронизируется с processById.
        const scopedMap = new Map<ScopeKey, Map<TaskName, Set<ProcessId>>>();
        // для "обратного" поиска Process -> task
        const identifierByProcess = new WeakMap<Process, Readonly<TaskIdentifier>>();


        return {

            register({ scopeKey, taskName }, processId, timestamp) {

                // #region DEBUG
                if (processById.has(processId)) {
                    assert.fail(`Duplicate process registration attempt: "${processId}" for ${taskName}`);
                }
                // #endregion DEBUG

                // Процесс всегда стартует в состоянии running — регистрация мёртвого
                // процесса не предусмотрена

                const process = { running: true, timestamp };

                processById.set(processId, process);

                identifierByProcess.set(process, { scopeKey, taskName });

                let namedMap = scopedMap.get(scopeKey);
                if (!namedMap) {
                    namedMap = new Map();
                    scopedMap.set(scopeKey, namedMap);
                }

                let processIds = namedMap.get(taskName);
                if (!processIds) {
                    processIds = new Set();
                    namedMap.set(taskName, processIds);
                }

                processIds.add(processId);

            },


            markCompleted(processes) {

                const out = new Map<ScopeKey, Set<TaskName>>();

                for (const processId of processes) {

                    // #region DEBUG
                    // Нарушение контракта: метод принимает только зарегистрированные процессы
                    assert.ok(processById.has(processId), `markCompleted: unregistered process "${processId}"`);
                    // #endregion DEBUG

                    const process = processById.get(processId)!;

                    if (!process.running) {
                        // процесс уже в состоянии completed
                        continue;
                    }

                    process.running = false;

                    // #region DEBUG
                    assert.ok(identifierByProcess.has(process),
                        `markCompleted: process "${processId}" in processById but missing from identifierByProcess — registration invariant violated`);
                    // #endregion DEBUG

                    const { scopeKey, taskName } = identifierByProcess.get(process)!;

                    let names = out.get(scopeKey);
                    if (names === undefined) {
                        names = new Set<TaskName>();
                        out.set(scopeKey, names);
                    }
                    names.add(taskName);
                }

                return out;
            },

            // @todo (Важность низкая)
            // При большом количестве зарегистрированных процессов полный обход byId
            // может быть затратным.
            // Можно хранить максимальный timestamp процессов, чтобы пропускать
            // итерацию, если снапшот старше всех процессов.
            reconcile({ requestId: timestamp, processIds }) {

                const out = new Map<ScopeKey, Set<TaskName>>();

                for (const [processId, process] of processById) {

                    if (processIds.has(processId)) {
                        continue;
                    }

                    if (timestamp < process.timestamp) {
                        // Процесс появился после снапшота — его отсутствие в нём ожидаемо
                        continue; // @todo break? можно если есть гарантия что в processById порядок строго от timestamp.
                    }

                    // процесс отсутствует в снапшоте и не новее него —
                    // вычищаем реестр запоминая идентификаторы

                    // #region DEBUG
                    assert.ok(identifierByProcess.has(process), `markCompleted: unregistered process "${processId}"`);
                    // #endregion DEBUG

                    const { scopeKey, taskName } = identifierByProcess.get(process)!;

                    let names = out.get(scopeKey);
                    if (names === undefined) {
                        names = new Set<TaskName>();
                        out.set(scopeKey, names);
                    }
                    names.add(taskName);

                    // Полная очистка реестра.
                    // Не должно остаться "пустых" состояний.
                    // -----
                    identifierByProcess.delete(process);
                    processById.delete(processId);

                    const namedMap = scopedMap.get(scopeKey)!;
                    const ids = namedMap.get(taskName)!;
                    ids.delete(processId);
                    if (ids.size === 0) {
                        namedMap.delete(taskName);
                        if (namedMap.size === 0) {
                            scopedMap.delete(scopeKey);
                        }
                    }
                }

                return out;
            },


            clear() {
                processById.clear();
                scopedMap.clear();
            },


            get(processId) {
                const process = processById.get(processId);
                if (process) {
                    return { ...process };
                }
                return undefined;
            },


            ProcessId: {
                get(scopeKey) {
                    if (!scopedMap.has(scopeKey)) {
                        return undefined;
                    }
                    return {
                        get(taskName) {
                            const namedMap = scopedMap.get(scopeKey);
                            if (!namedMap) {
                                return undefined; // scope исчез между ProcessId.get и этим вызовом
                            }
                            return new Set(namedMap.get(taskName));
                        }
                    };
                }
            } as const,


            Stats: {
                get(scopeKey) {
                    if (!scopedMap.has(scopeKey)) {
                        return undefined;
                    }
                    return {
                        get(taskName) {
                            const namedMap = scopedMap.get(scopeKey);
                            if (!namedMap) {
                                return undefined; // scope исчез между Summary.get и этим вызовом
                            }
                            const ids = namedMap.get(taskName);
                            if (!ids) {
                                return undefined;
                            }

                            // #region DEBUG
                            assert.ok(ids.size > 0, 'namedTask invariant violated: entry exists but set is empty');
                            // #endregion DEBUG

                            let total = 0;
                            let running = 0;
                            for (const processId of ids) {

                                // #region DEBUG
                                // Инвариант: каждый id в byTask должен присутствовать в byId
                                assert.ok(processById.has(processId), 'byId index out of sync: missing entry tracked in byTask');
                                // #endregion DEBUG

                                const process = processById.get(processId)!;

                                ++total;
                                if (process.running) {
                                    ++running;
                                }
                            }

                            return { total, running };
                        }
                    } as const;
                }
            } as const

        };
    }
} as const;

export default Registry;
