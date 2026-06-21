import {
    Memento,
    Disposable
} from 'vscode';
import Pins from './Pins';
import TaskName from '../type.d/TaskName';
import DefinitionId from '../EligibleTask/DefinitionId';
import type ScopeKey from '../Scope/Key';

// --- Storage infrastructure ---




// --- UserState ---

/** Точка доступа ко всему персистентному состоянию расширения.
 *
 * Создаётся один раз в `activate()` и живёт до деактивации.
 * Каждая сущность изолирована в своём ключе `workspaceState` —
 * конкурентных записей между слотами нет по определению.
 *
 * Расширение: добавить поле + ключ в `STORAGE_KEYS` + `dispose()`. */
class UserState implements Disposable {

    readonly #pins: Pins;
    // readonly history: History;
    // readonly uiState: UiState;

    readonly #disposables: Disposable[] = [];

    constructor(memento: Memento) {

        this.#disposables.push(
            // Pins
            this.#pins = new Pins(
                createSlot(memento, 'taskCockpit.pins.v1')
            ),
            // this.history = new History(...),
        );

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
    getPins(): Readonly<PinMap> {

    }


    get pins() {

        return {

            get() {

            },

            pin() { },
            unpin() { },
        } as const;
    }

    dispose(): void {
        this.#disposables.forEach(function (d) {
            d.dispose();
        });
    }
}


type Slots = {
    'taskCockpit.pins.v1': Record<ScopeKey, Record<TaskName, DefinitionId | null>>;
};


/** Типизированный слот поверх `vscode.Memento`.
 * */
function createSlot<K extends keyof Slots, T extends Slots[K]>(
    memento: Memento,
    key: K
) {
    return {
        read: function () { return memento.get<Readonly<T>>(key, Object.create(null)); },
        write: function (v: Readonly<T>) { return memento.update(key, v); },
    };
}

export default UserState;
