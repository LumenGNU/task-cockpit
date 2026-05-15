import * as vscode from 'vscode';
import Pins from './Pins';


// --- Storage infrastructure ---

/** Версионированные ключи всех слотов хранилища.
 *
 * Добавление новой сущности = одна строка здесь + один слот в `UserState`. */
const STORAGE_KEYS = {
    PINS: 'taskCockpit.pins.v1',
    // history: 'taskCockpit.history.v1',
    // uiState: 'taskCockpit.uiState.v1',
} as const;

/** Типизированный слот поверх `vscode.Memento`.
 *
 * Структурно совместим с `StorageInterface` внутри `Pins` —
 * явно имплементировать не нужно. */
interface StorageSlot<T extends Record<string, unknown>> {
    read(): Readonly<T>;
    write(value: Readonly<T>): Thenable<void>;
}

function createSlot<T extends Record<string, unknown>>(
    memento: vscode.Memento,
    key: string,
    defaultValue: T,
): StorageSlot<T> {
    return {
        read: () => memento.get<T>(key, defaultValue),
        write: (v) => memento.update(key, v),
    };
}

// --- UserState ---

/** Точка доступа ко всему персистентному состоянию расширения.
 *
 * Создаётся один раз в `activate()` и живёт до деактивации.
 * Каждая сущность изолирована в своём ключе `workspaceState` —
 * конкурентных записей между слотами нет по определению.
 *
 * Расширение: добавить поле + ключ в `STORAGE_KEYS` + `dispose()`. */
class UserState implements vscode.Disposable {

    readonly pins: Pins;
    // readonly history: History;
    // readonly uiState: UiState;

    readonly #disposables: vscode.Disposable[] = [];

    constructor(workspaceState: vscode.Memento) {

        this.#disposables.push(
            // Pins
            this.pins = new Pins(
                createSlot<Pins.Entries>(workspaceState, STORAGE_KEYS['PINS'], Object.create(null) as Pins.Entries)
            ),
            // this.history = new History(...),
        );

    }

    dispose(): void {
        this.#disposables.forEach(function (d) {
            d.dispose();
        });
    }
}

export default UserState;
