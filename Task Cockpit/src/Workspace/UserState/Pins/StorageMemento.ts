import type * as vscode from 'vscode';

/** Ключ persistent-хранилища в `workspaceState`.
 *
 * Версионирован (`.v1`). */
const STORAGE_KEY = 'pinnedTasks.v1';


/** Shared-дефолт для `read()`, когда ключа нет в хранилище.
 *
 * `Object.create(null)` — без прототипа, чтобы `for..in` не обходил
 * унаследованные ключи и не было коллизий с именами scope'ов. */
const EMPTY_STORED = Object.create(null);


// Persistent KV-хранилище в `workspaceState`.
//
// Формат: `ScopeIdentity → TaskName → definitionId | null`.
// Инвариант: пустой scope не хранится (см. {@link computeNextOnRemove}).
//
// Scope видимости: один extension host (одно окно VS Code). Запись
// в этом окне не оповещает другие окна того же workspace — тех.ограничение.
// Storage — per-host слой поверх `Memento`, а `Memento` событий об
// изменениях не предоставляет и когерентности между окнами не
// гарантирует. Синхронизация пинов между одновременно открытыми окнами
// одного проекта — за пределами ответственности этого модуля. 
// 
// {@link onShouldRefresh} оповещает подписчиков безусловно — без 
// сравнения старого и нового состояния.
interface PinStorage<T extends object> {
    read(): Readonly<T>;
    write(value: Readonly<T>): Thenable<void>;
}


const PinStorage = {

    create<T extends object>(storage: vscode.Memento): PinStorage<T> {
        return {
            read: () => storage.get<T>(STORAGE_KEY, EMPTY_STORED),
            write: (v) => storage.update(STORAGE_KEY, v),
        };
    }

};

export default PinStorage;