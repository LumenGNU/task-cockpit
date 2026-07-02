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
import type ResourceConfig from './Resource/Config';
import type Scope from '../Scope/Scope';
import type WindowConfig from './Window/Config';
import WINDOW_SCHEMA from './Window/SCHEMA';
import isGlobal from '../Scope/isGlobal';



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
            configurationScope: (isWorkspace(scope) || isGlobal(scope)) ? null : scope
        });
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






// -----


export default ConfigurationProvider;
