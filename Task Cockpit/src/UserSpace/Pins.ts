/** Модуль управления «закреплёнными» (pinned) задачами в пределах workspace.
 *
 * Закреплённая задача — это ссылка на конкретное имя задачи (`TaskName`)
 * в рамках определённой области видимости (`Scope`). Помимо имени, хранится
 * идентификатор определения задачи (`DefinitionId`) на момент закрепления,
 * чтобы стабилизировать ссылку при повторном сканировании workspace.
 *
 * Полагается на последовательную очередь операций `AsyncQueue`.
 *
 * Все изменения в хранилище проходят через сериализованную очередь,
 * что гарантирует отсутствие гонок при конкурентных вызовах `pin()`/`unpin()`.
 *
 * Инвариант хранения: пустых scope’ов в не существует —
 * при удалении последнего пина scope полностью удаляется из хранилища. */

import {
    type Memento,
    type LogOutputChannel
} from 'vscode';
import AsyncQueue from '../utils/AsyncQueue';
import type DefinitionId from '../EligibleTask/DefinitionId';
import type PinMap from './PinMap';
import type ScopeKey from '../Scope/Key';
import type TaskName from '../type.d/TaskName';


class Pins {

    static get STORAGE_KEY() { return 'papio-dev.taskCockpit.pins.v1'; };

    /** Очередь, обеспечивающая последовательное выполнение асинхронных операций. */
    readonly #queue: AsyncQueue;

    readonly #memento: Memento;

    readonly #logOutputChannel;


    /** Создаёт экземпляр класса `Pins`, связанный с конкретным хранилищем.
     *
     * @param storage Объект, реализующий `StorageInterface`. */
    constructor(memento: Memento, logOutputChannel: LogOutputChannel | null = null) {

        this.#logOutputChannel = logOutputChannel;

        this.#queue = new AsyncQueue();
        this.#memento = memento;

    }


    public get(): Readonly<PinMap> {
        return this.#read();
    }


    public update(pins: Readonly<PinMap>) {
        return this.#queue.enqueue(() => {
            return this.#write(pins);
        });
    }


    /** Добавляет задачу в список закреплённых.
     *
     * Операция ставится в очередь и применяется последовательно.
     *
     * @returns Promise, разрешающийся после завершения операции записи. */
    public pin(scopeKey: ScopeKey, name: TaskName, definition: DefinitionId | undefined): Promise<void> {

        return this.#queue.enqueue(() => {
            const current = this.#read();
            let scoped = current.get(scopeKey);
            if (!scoped) {
                scoped = new Map();
                current.set(scopeKey, scoped);
            }
            scoped.set(name, definition ?? null);
            return this.#write(current);
        });
    }


    /** Удаляет задачу по имени из пинов конкретного scope.
     *
     * Если после удаления scope остаётся без пинов, он полностью удаляется
     * из хранилища (инвариант отсутствия пустых scope’ов).
     *
     * Если переданный `key` отсутствует в хранилище, операция ничего
     * не делает.
     *
     * @param key  Ключ scope.
     * @param taskName Имя задачи, которую нужно открепить.
     * @returns Promise, разрешающийся после завершения записи. */
    public unpin(scopeKey: ScopeKey, taskName: TaskName): Promise<void> {

        return this.#queue.enqueue(() => {
            const current = this.#read();
            const scoped = current.get(scopeKey);
            if (!scoped) return Promise.resolve(); // ничего не изменилось, не пишем
            scoped.delete(taskName);
            if (scoped.size < 1) {
                current.delete(scopeKey);
            }
            return this.#write(current);
        });
    }


    #read(): Map<ScopeKey, Map<TaskName, DefinitionId | null>> {
        try {
            const val = this.#memento.get<(readonly [ScopeKey, readonly [TaskName, DefinitionId | null][]])[]>(Pins.STORAGE_KEY, []);
            return new Map(val.map(function ([scopeKey, record]) {
                return [scopeKey, new Map(record)];
            }));
        }
        catch (err) {
            if (this.#logOutputChannel) {
                this.#logOutputChannel.error('Pins.read failed: ' + String(err));
            }
            return new Map();
        }
    }


    #write(map: ReadonlyMap<ScopeKey, ReadonlyMap<TaskName, DefinitionId | null>>) {
        const val = [...map.entries()].map(function ([scopeKey, innerMap]) {
            return [scopeKey, [...innerMap.entries()] as const] as const;
        });
        return this.#memento.update(Pins.STORAGE_KEY, val);
    }
}


export default Pins;

// ----------------------------------------
