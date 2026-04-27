import * as vscode from 'vscode';
import type {
    TaskName,
    ScopeKey
} from '../../../types';
import AsyncQueue from '../../../utils/AsyncQueue';


interface StorageInterface {
    read(): Readonly<Pins.Entries>;
    write(value: Readonly<Pins.Entries>): Thenable<void>;
}


declare namespace Pins {

    /** Набор закреплённых задач в пределах одного scope.
     *
     * Ключ — user-facing label задачи. Значение — `definitionId` на момент
     * закрепления (или `null`, если неизвестен), используется для
     * стабилизации ссылки на задачу при ре-сканировании. */
    type Refs = { [k: TaskName]: /*definitionId*/string | null; };


    /** Формат хранилища: scope → набор пинов.
     *
     * Инвариант: пустых `TaskRefs` в хранилище не бывает — при последнем
     * удалении пина scope сносится целиком. Соблюдение инварианта —
     * ответственность потребителя. */
    type Entries = Record<ScopeKey, Pins.Refs>;

}


class Pins implements vscode.Disposable {

    private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();


    /** Срабатывает после каждой записи в store из этого экземпляра.
     *
     * Payload нет: подписчик перечитывает `get()` и сверяет со своей
     * моделью. Сигнал означает "авторитетное состояние могло измениться",
     * а не "изменилось". */
    readonly onShouldRefresh: vscode.Event<void> = this.onDidChangeEmitter.event;


    private readonly queue = new AsyncQueue();


    constructor(
        private readonly storage: StorageInterface
    ) { }


    public dispose(): void {
        this.onDidChangeEmitter.dispose();
    }


    /** Возвращает все пины, сгруппированные по scope.
     *
     * Read-only view текущего состояния.
     *
     * Пустых scope'ов в результате не бывает. */
    public get(): Readonly<Pins.Entries> {
        return this.storage.read();
    }


    public pin(scopeKey: ScopeKey, taskName: TaskName, definitionId: string | null): Promise<void> {

        return this.queue.enqueue(async () => {
            const current = this.storage.read();
            const next = {
                ...current,
                [scopeKey]: { ...current[scopeKey], [taskName]: definitionId },
            };
            await this.storage.write(next);
            this.onDidChangeEmitter.fire();
        });
    }

    public unpin(scopeKey: ScopeKey, taskName: TaskName): Promise<void> {

        return this.queue.enqueue(async () => {
            const current = this.storage.read();
            const scopeEntry = current[scopeKey];
            await this.storage.write(
                scopeEntry
                    ? removePinFromStorage(current, scopeKey, scopeEntry, taskName)
                    : current
            );
            this.onDidChangeEmitter.fire();
        });
    }



}


/** Вычисляет новое состояние хранилища после удаления `taskName` из `scopeEntry`.
 *
 * Два случая:
 * 1. в scope остались другие пины → scope обновляется без `taskName`.
 * 2. scope опустел → scope удаляется из хранилища целиком.
 *
 * Immutable: при изменениях возвращается новый объект. */
function removePinFromStorage(
    current: Readonly<Pins.Entries>,
    scopeKey: ScopeKey,
    scopeEntry: Pins.Refs,
    taskName: TaskName,
): Pins.Entries {

    const { [taskName]: _removed, ...rest } = scopeEntry;

    for (const _ in rest) {
        return { ...current, [scopeKey]: rest };
    }

    // сюда попадаем только если rest пустой
    // в scope не осталось пинов — сносим scope целиком
    const next = { ...current };
    delete next[scopeKey];
    return next;
}
