import {
    EventEmitter,
    type ConfigurationChangeEvent,
    type Disposable,
    type Event,
    workspace,
} from 'vscode';
import {
    collectSections,
    createSchema,
    read,
    type ConfigSchema,
} from './ConfigSchema';
import * as assert from 'node:assert/strict';
import isWorkspace from '../Scope/isWorkspace';
import RESOURCE_SCHEMA from './Resource/SCHEMA';
import type Group from './Group';
import type Icon from './Icon';
import type RawTaskDefinition from './RawTaskDefinition';
import type ResourceConfig from './Resource/Config';
import type Scope from '../Scope/Scope';
import type TaskDefinition from './TaskDefinition';
import type TaskGroup from './TaskGroup';
import type TaskName from '../type.d/TaskName';
import type WindowConfig from './Window/Config';
import WINDOW_SCHEMA from './Window/SCHEMA';


type WindowConfigKey = keyof typeof WINDOW_SCHEMA;
type AffectedKeys = 'BASE' | 'TASKS' | WindowConfigKey;


class ConfigurationProvider implements Disposable {

    readonly #onDidChange: EventEmitter<Set<AffectedKeys>>;
    readonly onDidChange: Event<Set<AffectedKeys>>;

    readonly #baseConfigSection: string;
    readonly #windowSchema: Readonly<ConfigSchema<WindowConfig>>;
    readonly #resourceSchema: Readonly<ConfigSchema<ResourceConfig>>;

    readonly #windowSectionsByKey: ReadonlyMap<WindowConfigKey, ReadonlySet<string>>;

    #windowConfiguration: Readonly<WindowConfig> | null;

    #disposed: boolean;

    readonly #disposables: Disposable[];

    public constructor(
        baseConfigSection: string
    ) {

        this.#disposed = false;

        this.#baseConfigSection = baseConfigSection;

        this.#windowSchema = createSchema<WindowConfig>(WINDOW_SCHEMA);
        this.#resourceSchema = createSchema<ResourceConfig>(RESOURCE_SCHEMA);

        this.#windowSectionsByKey = collectSections(this.#windowSchema);

        this.#windowConfiguration = null;

        this.#onDidChange = new EventEmitter();

        /** Срабатывает при любом изменении конфигурации, затронувшем базовый раздел
         * (`baseConfigSection`) и/или раздел задач (`tasks`).
         *
         * Содержимое `Set<AffectedKeys>`:
         * - `'TASKS'`              — изменился раздел `tasks.*`
         * - `'BASE'`               — изменился `baseConfigSection`, но ни один конкретный
         *                            window-ключ не был затронут
         * - {@link WindowConfigKey} — конкретный window-ключ, чьи секции были затронуты
         *
         * Само событие уже означает наличие релевантных изменений. Дополнительно,
         * наличие ключа {@link WindowConfigKey} означает — изменение в конкретной
         * "глобальной" секции.
         * */
        this.onDidChange = this.#onDidChange.event;

        this.#disposables = [
            this.#onDidChange,
            workspace.onDidChangeConfiguration(this.#onDidChangeConfigurationHandler, this)
        ];
    }


    public dispose() {
        if (this.#disposed) {
            return;
        }
        this.#disposed = true;

        this.#disposables.forEach(function (d) {
            d.dispose();
        });
    }


    public readWindowConfig<K extends WindowConfigKey>(configKey: K): Readonly<WindowConfig[K]> {

        assert.equal(this.#disposed, false);

        const configuration =
            this.#windowConfiguration ??= read({
                schema: this.#windowSchema,
                baseSection: this.#baseConfigSection,
                configurationScope: null
            });

        return configuration[configKey];
    }


    public readResourceConfig(scope: Scope): Readonly<ResourceConfig> {

        assert.equal(this.#disposed, false);

        return read({
            schema: this.#resourceSchema,
            baseSection: this.#baseConfigSection,
            configurationScope: isWorkspace(scope) ? null : scope
        });
    }


    /** Карта определений задач, проиндексированная по имени задачи ({@link TaskName}).
     *
     * - Ключ: строковое имя задачи (`label`), прошедшее валидацию.
     * - Значение: объект {@link TaskDefinition}, содержащий нормализованные поля
     *   (`group`, `icon`, `hidden`, `isBackground`).
     *
     * Особенности:
     * - Порядок записей соответствует порядку в исходном файле
     * - При наличии дубликатов ключей последние определения перезаписывают предыдущие.
     * - Карта является `ReadonlyMap`, не предполагается модификация
     *   после построения.
     *  */
    public readTasks(scope: Scope): ReadonlyMap<TaskName, TaskDefinition> {

        assert.equal(this.#disposed, false);

        const configScope = isWorkspace(scope) ? null : scope;

        const inspected = workspace
            .getConfiguration('tasks', configScope)
            .inspect<Array<RawTaskDefinition>>('tasks');

        return ((configScope == null
            ? inspected?.workspaceValue
            : inspected?.workspaceFolderValue) ?? [])
            .reduce(mapDefinitions, new Map<TaskName, TaskDefinition>());
    }


    #onDidChangeConfigurationHandler(event: ConfigurationChangeEvent) {

        if (this.#disposed) {
            return;
        }

        const tasksChanged = event.affectsConfiguration('tasks');
        const baseSectionChanged = event.affectsConfiguration(this.#baseConfigSection);
        if (!tasksChanged && !baseSectionChanged) {
            // нет релевантных изменений
            return;
        }

        const affectedKeys =
            tasksChanged
                ? new Set<AffectedKeys>(['BASE', 'TASKS']) // если есть любые изменения в задачах
                : new Set<AffectedKeys>(['BASE']);

        for (const [key, sectionSet] of this.#windowSectionsByKey) {
            for (const section of sectionSet) {
                if (event.affectsConfiguration(`${this.#baseConfigSection}.${section}`)) {
                    affectedKeys.add(key);
                    break;
                }
            }
        }

        if (affectedKeys.size > 0) {
            this.#windowConfiguration = null;
        }

        this.#onDidChange.fire(affectedKeys);

    }
}


function mapDefinitions(
    map: Map<TaskName, TaskDefinition>,
    raw: RawTaskDefinition,
): Map<TaskName, TaskDefinition> {

    // Пропускаем записи без- или с невалидным названием.
    if (!nameIsQualifies(raw.label)) {
        return map;
    }

    const definition: TaskDefinition = {
        hidden: parseHidden(raw.hide),
        isBackground: parseIsBackground(raw.isBackground),
        icon: parseIcon(raw.icon),
        group: parseGroup(raw.group),
        taskName: raw.label,
    };

    // (дубликаты label'ов возможны, но будут поглощены)
    map.set(raw.label, definition);
    return map;
}


// #region Валидаторы/парсеры
// --------------------------

/** Проверяет, что значение является непустой строкой
 * и может использоваться как ключ. */
function nameIsQualifies(raw: unknown): raw is TaskName {
    return typeof raw === 'string' && raw.length > 0;
}


/** Разбирает сырое значение `group` из файла-источника.
 *
 * Допустимые формы:
 * - строка — преобразуется в объект с `isDefault: false`;
 * - объект с полем `kind` — извлекается `kind` и `isDefault`.
 *
 * @returns `null` при отсутствии или невалидном значении. */
function parseGroup(raw: unknown): TaskGroup | null {

    if (raw == null) {
        return null;
    }

    if (typeof raw === 'string') {
        return { kind: capitalizeKind(raw), isDefault: false };
    }

    if (typeof raw === 'object' && 'kind' in raw && typeof raw.kind === 'string') {

        return {
            kind: capitalizeKind(raw.kind),
            isDefault: 'isDefault' in raw && raw.isDefault === true
        };
    }

    return null;
}


/** Приводит первую букву `kind` к верхнему регистру
* (`"build"` → `"Build"`). */
function capitalizeKind(kind: string): Group {
    return kind.charAt(0).toUpperCase() + kind.slice(1) as Group;
}


/** Разбирает сырое значение `icon` из файла-источника.
 *
 * Ожидает объект с необязательными полями `id` (codicon)
 * и `color` (ThemeColor). Хотя бы одно должно присутствовать.
 *
 * @returns `null` если не объект или оба поля отсутствуют. */
function parseIcon(raw: unknown): Icon | null {

    if (raw == null || typeof raw !== 'object') {
        return null;
    }

    const id = 'id' in raw && typeof raw.id === 'string' ? raw.id : undefined;
    const color = 'color' in raw && typeof raw.color === 'string' ? raw.color : undefined;

    return (id || color) ? { id, color } : null;
}


/** @returns `true` только если сырое значение — литерал `true`. */
function parseHidden(raw: unknown): boolean {
    return typeof raw === 'boolean' ? raw === true : false;
}


/** @returns `true` только если сырое значение — литерал `true`. */
function parseIsBackground(raw: unknown): boolean {
    return typeof raw === 'boolean' ? raw === true : false;
}

// #endregion Валидаторы/парсеры

// -----


export default ConfigurationProvider;
