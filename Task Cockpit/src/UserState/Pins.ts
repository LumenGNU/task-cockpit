/** Модуль управления «закреплёнными» (pinned) задачами в пределах workspace.
 *
 * Закреплённая задача — это ссылка на конкретное имя задачи (`TaskName`)
 * в рамках определённой области видимости (`Scope`). Помимо имени, хранится
 * идентификатор определения задачи (`DefinitionId`) на момент закрепления,
 * чтобы стабилизировать ссылку при повторном сканировании workspace.
 *
 * Модуль предоставляет:
 * - интерфейс хранилища `StorageInterface`,
 * - описание формата данных `Pins.Entries` и `Pins.Refs`,
 * - класс `Pins`, реализующий логику добавления, удаления и чтения пинов,
 * - вспомогательную чистую функцию `removePinFromStorage`,
 *
 * Полагается на последовательную очередь операций `AsyncQueue`.
 *
 * Все изменения в хранилище проходят через сериализованную очередь,
 * что гарантирует отсутствие гонок при конкурентных вызовах `pin()`/`unpin()`.
 * После каждой успешной записи выбрасывается событие `onShouldRefresh`,
 * сигнализирующее, что авторитетное состояние могло измениться и подписчикам
 * следует перечитать его через `get()`.
 *
 * Инвариант хранения: пустых scope’ов в `Pins.Entries` не существует —
 * при удалении последнего пина scope полностью удаляется из хранилища. */

import * as vscode from 'vscode';
import AsyncQueue from '../utils/AsyncQueue';
import Scope from '../ProjectSpace/Scope/Scope';
import type EligibleTask from '../EligibleTask';
import type TaskName from '../type.d/TaskName';
import type Key from '../ProjectSpace/Scope/Key';
import type DefinitionId from '../type.d/DefinitionId';


/** Контракт хранилища данных пинов.
 *
 * Реализация может быть, например, на основе `vscode.Memento`
 * (globalState / workspaceState) или любого другого key-value store. */
interface StorageInterface {
    /** Прочитать актуальное состояние пинов. */
    read(): Readonly<Pins.Entries>;
    /** Записать новое состояние. Операция асинхронна, возвращает Thenable. */
    write(value: Readonly<Pins.Entries>): Thenable<void>;
}


declare namespace Pins {

    /** Набор закреплённых задач в пределах одного scope.
     *
     * Ключ — пользовательское имя задачи (`TaskName`).
     * Значение — `DefinitionId` на момент закрепления (или `null`, если
     * идентификатор неизвестен). Используется для стабилизации ссылки
     * на задачу при повторном перестроении списка задач (ре-сканировании
     * workspace и т.п.). */
    interface Refs {
        [k: TaskName]: DefinitionId | null;
    }


    /** Формат хранилища: scope → набор пинов.
     *
     * Инвариант: пустых `Refs` в хранилище не бывает — при последнем
     * удалении пина scope удаляется из объекта целиком. */
    type Entries = Record<Key, Pins.Refs>;

}


/** Основной класс для работы с закреплёнными задачами.
 *
 * Обеспечивает:
 * - чтение актуального среза пинов через `get()`;
 * - добавление новой задачи в пины с помощью `pin()`;
 * - удаление задачи из пинов с помощью `unpin()`;
 * - событие `onShouldRefresh`, которое вызывается после каждого изменения,
 *   чтобы внешние подписчики могли синхронизировать своё состояние.
 *
 * Все мутирующие операции (`pin`, `unpin`) сериализуются через внутреннюю
 * очередь `AsyncQueue`, что исключает состояние гонки при параллельных
 * вызовах и гарантирует последовательное применение изменений к хранилищу. */
class Pins implements vscode.Disposable {

    /** Эмиттер, используемый для оповещения о возможном изменении состояния. */
    readonly #onShouldRefresh = new vscode.EventEmitter<void>();

    /** Очередь, обеспечивающая последовательное выполнение асинхронных операций. */
    readonly #queue = new AsyncQueue();

    /** Ссылка на реализацию хранилища (read/write). */
    readonly #storage: Readonly<StorageInterface>;

    /** Событие, которое срабатывает после каждой успешной записи в хранилище
     * из **этого экземпляра** `Pins`.
     *
     * Подписчики должны воспринимать его как сигнал «авторитетное состояние
     * могло измениться». Рекомендуется перечитать `get()` и сравнить
     * со своей локальной моделью. */
    readonly onShouldRefresh: vscode.Event<void> = this.#onShouldRefresh.event;

    /**Создаёт экземпляр класса `Pins`, связанный с конкретным хранилищем.
     *
     * @param storage Объект, реализующий `StorageInterface`. */
    constructor(storage: Readonly<StorageInterface>) {
        this.#storage = storage;
    }

    /** Освобождает ресурсы (в частности, эмиттер событий). */
    public dispose(): void {
        this.#onShouldRefresh.dispose();
    }


    /** Возвращает неизменяемое представление всех пинов, сгруппированных
     * по scope’ам.
     *
     * Метод не выполняет глубокого копирования, поэтому возвращаемый объект
     * следует рассматривать как Readonly.
     *
     * В результирующем объекте отсутствуют пустые scope’ы.
     *
     * @returns Текущее состояние хранилища пинов. */
    public get(): Readonly<Pins.Entries> {
        return this.#storage.read();
    }


    /** Добавляет задачу в список закреплённых.
     *
     * Извлекает имя задачи, scope и идентификатор определения из переданного
     * `task`. Если идентификатор неизвестен, сохраняется `null`.
     *
     * Операция ставится в очередь и применяется последовательно.
     * После записи вызывает `onShouldRefresh`.
     *
     * @param task Задача, которую необходимо закрепить.
     * @returns Promise, разрешающийся после завершения операции записи. */
    public pin(task: EligibleTask): Promise<void> {

        const { name, scope, definition: { id } } = task;

        const key: Key = Scope.getKey(scope);

        return this.#queue.enqueue(async () => {
            const current = this.#storage.read();
            const next = {
                ...current,
                [key]: { ...current[key], [name]: id ?? null },
            };
            await this.#storage.write(next);
            this.#onShouldRefresh.fire();
        });
    }

    /** Удаляет задачу по имени из пинов конкретного scope.
     *
     * Если после удаления scope остаётся без пинов, он полностью удаляется
     * из хранилища (инвариант отсутствия пустых scope’ов).
     *
     * Если переданный `key` отсутствует в хранилище, операция ничего
     * не делает. При этом событие `onShouldRefresh` всё равно вызывается —
     * это позволяет клиентам с рассинхронизированной моделью получить
     * актуальное состояние через `get()`.
     *
     * @param key  Ключ scope (результат `Scope.getKey()`).
     * @param name Имя задачи, которую нужно открепить.
     * @returns Promise, разрешающийся после завершения записи. */
    public unpin(key: Key, name: TaskName): Promise<void> {

        return this.#queue.enqueue(async () => {
            const current = this.#storage.read();
            const scopeEntry = current[key];
            if (scopeEntry) {
                await this.#storage.write(
                    scopeEntry
                        ? removePinFromStorage(current, key, scopeEntry, name)
                        : current
                );
            }
            this.#onShouldRefresh.fire();
        });
    }
}


/** Чистая функция вычисления нового состояния хранилища после удаления
 * пина `name` из `entry`.
 *
 * Поведение:
 * 1. Если после удаления в scope остаются другие задачи, возвращается
 *    новый объект хранилища с обновлённым `Refs` для этого scope.
 * 2. Если scope становится пустым, он полностью удаляется из хранилища
 *    (ключ удаляется), что соответствует инварианту `Pins.Entries`.
 *
 * Функция не мутирует исходный объект `current` — всегда возвращает новое
 * значение (или то же самое, если удаление не затронуло ничего, что в данной
 * реализации невозможно, т.к. `entry` гарантированно содержит `name`).
 *
 * @param current Текущее состояние хранилища.
 * @param key     Ключ scope, из которого удаляется пин.
 * @param entry   Объект пинов конкретного scope (гарантированно содержит `name`).
 * @param name    Имя удаляемой задачи.
 * @returns Новое состояние хранилища.
 */
function removePinFromStorage(
    current: Readonly<Pins.Entries>,
    key: Key,
    entry: Pins.Refs,
    name: TaskName,
): Pins.Entries {

    // Извлекаем удаляемую задачу, оставшиеся попадают в `rest`.
    const { [name]: _removed, ...rest } = entry;

    // Если в `rest` есть хоть одно свойство — scope не пуст.
    // Возвращаем хранилище с обновлённым набором пинов для этого scope.
    if (Object.keys(rest).length > 0) {
        return { ...current, [key]: rest };
    }

    // Сюда попадаем только если `rest` пуст — scope опустел.
    // Удаляем ключ scope из хранилища целиком.
    const next = { ...current };
    delete next[key];
    return next;
}


export default Pins;
