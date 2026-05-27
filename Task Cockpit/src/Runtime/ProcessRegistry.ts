/** @file Runtime/ProcessRegistry.ts */
/** @module ProcessRegistry */

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


import EligibleTask from '../EligibleTask';
import type ProcessId from '../type.d/ProcessId';
import type TaskId from '../type.d/TaskId';
import assert from 'node:assert/strict';


declare namespace ProcessRegistry {

    /** Состояние процесса задачи в реестре. */
    export interface Process {
        /** Флаг — в состоянии выполнения */
        running: boolean;
        /** Метка времени регистрации */
        timestamp: number;
        /** Id задачи, запустившей процесс */
        taskId: TaskId;
    }

    export interface ProcessStats {
        /** Общее количество процессов у задачи */
        total: number;
        /** Процессы задачи в состоянии выполнения */
        running: number;
    }

}


interface ProcessRegistry {

    /** Регистрация нового процесса в реестре. Дубликаты — ошибка
     *
     * @param processId id процесса
     * @param taskId id задачи породившей процесс
     * @param timestamp Метка времени регистрации  */
    register(processId: ProcessId, taskId: TaskId, timestamp: number): void;


    /** Перевести указанные процессы в состояние "выполнен"
     * Передавать можно только зарегистрированные процессы
     * @param processes
     * @returns Возвращает массив `TaskId`, задач затронутых изменением. */
    markCompleted(processes: ReadonlyArray<ProcessId>): ReadonlyArray<TaskId>;


    // /** Удаляет указанные процессы из реестра.
    //  *
    //  * Удалять можно только зарегистрированные процессы.
    //  *
    //  * @param processes — массив id для удаления. Повторы не допустимы.
    //  * @returns Возвращает массив `TaskId`, задач затронутых изменением. */
    // unregister(processes: ReadonlyArray<ProcessId>): ReadonlyArray<TaskId>;


    /** Удаляет из реестра процессы, которых нет в снапшоте.
     *
     * Если снапшот старше процесса (`snapshot.timestamp < processInfo.timestamp`),
     * процесс пропускается — он появился после начала сбора снапшота.
     * @param snapshot Снимок состояния системы в момент времени.
     *   Ожидается что снимок всегда полный (нет пропущенных процессов). */
    reconcileSnapshot(snapshot: Readonly<{
        /** Time-штамп снапшота */
        timestamp: number;
        /** Список процессов, реально присутствующих в системе */
        processIds: ReadonlySet<ProcessId>;
    }>): ReadonlyArray<TaskId>;


    /** Возвращает снимок состояния процесса, или `undefined` если
     * процесс не зарегистрирован. */
    getByProcessId(id: ProcessId): Readonly<ProcessRegistry.Process> | undefined;


    /** Возвращает множество id процессов, порождённых указанной задачей,
     *  или `undefined` если задача не имеет зарегистрированных процессов. */
    getByTaskId(taskId: TaskId): ReadonlySet<ProcessId> | undefined;


    /** Возвращает агрегированную статистику по процессам задачи:
     *  общее количество и количество активных (`running: true`).
     *  `undefined` — задача не имеет зарегистрированных процессов. */
    summaryByTaskId(taskId: TaskId): Readonly<ProcessRegistry.ProcessStats> | undefined;

}


const ProcessRegistry = {

    /** Создаёт новый изолированный экземпляр реестра процессов. */
    create(): ProcessRegistry {

        // Основной индекс: processId → состояние процесса
        const byId = new Map<ProcessId, ProcessRegistry.Process>();
        // Вторичный индекс: taskId → множество processId. Синхронизируется с byId.
        const byTask = new Map<TaskId, Set<ProcessId>>();

        const unregister = function (processes: ReadonlyArray<ProcessId>): ReadonlyArray<TaskId> {

            const tasks = new Set<TaskId>();

            for (const processId of processes) {

                const process = byId.get(processId);
                // Нарушение контракта: метод принимает только зарегистрированные процессы
                assert.ok(process, `unregister: unregistered process "${processId}"`);

                byId.delete(processId);

                const set = byTask.get(process.taskId);
                assert.ok(set, 'byTask index out of sync: missing entry for registered process');
                set.delete(processId);

                if (set.size < 1) {
                    byTask.delete(process.taskId);
                }

                tasks.add(process.taskId);
            }

            return [...tasks];
        };

        return {

            register(processId, taskId, timestamp) {

                if (byId.has(processId)) {
                    assert.fail(`Duplicate process registration attempt: "${processId}" for ${EligibleTask.Id.print(taskId)}`);
                }

                // Процесс всегда стартует в состоянии running — регистрация мёртвого процесса не предусмотрен контрактом
                byId.set(processId, { running: true, timestamp, taskId });

                let ids = byTask.get(taskId);
                if (!ids) {
                    ids = new Set();
                    byTask.set(taskId, ids);
                }
                ids.add(processId);

            },


            markCompleted(processes) {

                const tasks = new Set<TaskId>();

                for (const processId of processes) {

                    const process = byId.get(processId);
                    // Нарушение контракта: метод принимает только зарегистрированные процессы
                    assert.ok(process, `markCompleted: unregistered process "${processId}"`);
                    process.running = false;
                    tasks.add(process.taskId);
                }

                return [...tasks];
            },

            // @todo (Важность низкая)
            // При большом количестве зарегистрированных процессов полный обход byId
            // может быть затратным.
            // Можно хранить максимальный timestamp процессов, чтобы пропускать
            // итерацию, если снапшот старше всех процессов.
            reconcileSnapshot({ timestamp, processIds }) {

                // Собираем процессы, отсутствующие в снапшоте и не новее него
                const ids = [];

                for (const [processId, process] of byId) {

                    if (processIds.has(processId)) {
                        continue;
                    }

                    if (timestamp < process.timestamp) {
                        // Процесс появился после снапшота — его отсутствие в нём ожидаемо
                        // #region DEBUG
                        log(LogLevel.Trace, `Snapshot outdated for process "${processId}" (${timestamp} < ${process.timestamp}), skipping removal check`);
                        // #endregion DEBUG
                        continue;
                    }

                    ids.push(processId);
                }

                if (ids.length > 0) {
                    return unregister(ids);
                }

                return [];
            },


            getByProcessId(id) {
                const process = byId.get(id);
                if (process) {
                    return { ...process };
                }
                return undefined;
            },


            getByTaskId(taskId) {

                const ids = byTask.get(taskId);
                if (!ids) {
                    return undefined;
                }

                return new Set(ids);
            },


            summaryByTaskId(taskId: TaskId): Readonly<{ total: number; running: number; }> | undefined {

                const ids = byTask.get(taskId);
                if (!ids) {
                    return undefined;
                }

                assert.ok(ids.size > 0, 'byTask invariant violated: entry exists but set is empty');

                let total = 0;
                let running = 0;
                for (const processId of ids) {
                    const process = byId.get(processId);
                    // Инвариант: каждый id в byTask должен присутствовать в byId
                    assert.ok(process, 'byId index out of sync: missing entry tracked in byTask');
                    ++total;
                    if (process.running) {
                        ++running;
                    }
                }

                return { total, running };
            }

        };
    }
};


export default ProcessRegistry;
