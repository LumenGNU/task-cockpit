import {
    EventEmitter,
    type ConfigurationChangeEvent,
    type Disposable,
    type Event,
    workspace,
} from 'vscode';
import SCHEMA from './SCHEMA';
import Config from './Config';
import * as assert from 'node:assert/strict';
import {
    collectSections,
    createSchema,
    read,
    type ConfigSchema,
} from '../Configuration';


type ConfigKey = keyof typeof SCHEMA;


class GlobalConfig implements Disposable {

    readonly #onDidChange: EventEmitter<ConfigKey>;
    readonly onDidChange: Event<ConfigKey>;

    readonly #baseSection: string;
    readonly #schema: Readonly<ConfigSchema<Config>>;

    readonly #sectionsMap: ReadonlyMap<ConfigKey, ReadonlySet<string>>;

    #configuration: Readonly<Config> | null;

    #disposed: boolean;

    readonly #disposables: Disposable[];

    constructor(baseConfigSection: string) {

        this.#disposed = false;

        this.#baseSection = baseConfigSection;

        const schema = createSchema<Config>(SCHEMA);

        this.#sectionsMap = collectSections({
            schema,
            baseSection: baseConfigSection
        });

        this.#schema = schema;

        this.#configuration = null;

        this.#onDidChange = new EventEmitter();
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


    public read<K extends ConfigKey>(configKey: K): Readonly<Config[K]> {

        assert.equal(this.#disposed, false);

        const configuration =
            this.#configuration ??= read({
                schema: this.#schema,
                baseSection: this.#baseSection,
                configurationScope: null
            });

        return configuration[configKey];
    }


    #onDidChangeConfigurationHandler(event: ConfigurationChangeEvent) {

        if (this.#disposed) {
            return;
        }

        const affectedKeys = new Set<ConfigKey>();

        for (const [key, sectionSet] of this.#sectionsMap) {
            for (const section of sectionSet) {
                if (event.affectsConfiguration(section)) {
                    affectedKeys.add(key);
                    break;
                }
            }
        }

        if (affectedKeys.size > 0) {

            this.#configuration = null;

            for (const key of affectedKeys) {
                this.#onDidChange.fire(key);
            }
        }

    }
}


export default GlobalConfig;
