import {
    EventEmitter,
    workspace,
    LogOutputChannel,
} from 'vscode';
import {
    collectSections,
    createSchema
} from '../ConfigSchema';
import * as assert from 'node:assert/strict';
import WINDOW_SCHEMA from './SCHEMA';
import readWindowConfig from './readWindowConfig';

import type {
    Disposable,
    Event,
} from 'vscode';
import type {
    ConfigSchema
} from '../ConfigSchema';
import type Immutable from '../utils/Immutable';
import type Safe from '../utils/Safe';
import type WindowConfig from './Config';


type ConfigKey = WindowConfiguration.ConfigKey;
type AffectedKeys = WindowConfiguration.AffectedKeys;

export declare namespace WindowConfiguration {

    export type ConfigKey = keyof typeof WINDOW_SCHEMA;
    export type AffectedKeys = Set<ConfigKey>;
}

export class WindowConfiguration implements Disposable {

    /** Базовый ключ конфигурации */
    readonly #baseConfigSection: string;

    /** Схема валидации window-конфигурации */
    readonly #windowConfigSchema: Immutable<ConfigSchema<WindowConfig>>;

    /** Карта "ключ window-конфигурации" → все секции конфигурации, принадлежащие этому ключу. */
    readonly #sectionsByKey: Immutable<Map<ConfigKey, Array<string>>>;

    readonly #onDidChange: EventEmitter<Immutable<AffectedKeys>>;
    readonly onDidChange: Event<Immutable<AffectedKeys>>;

    readonly #onDidDisposed: EventEmitter<void>;
    readonly onDidDisposed: Event<void>;

    readonly #logOutputChannel: Safe<LogOutputChannel> | null;

    readonly #disposables: Disposable[];
    #disposed: boolean;

    /** Кеш window-конфигурации */
    #configuration!: Immutable<WindowConfig>;


    constructor(
        baseConfigSection: string,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {

        this.#disposed = false;

        this.#baseConfigSection = baseConfigSection;
        this.#logOutputChannel = logOutputChannel;

        this.#onDidChange = new EventEmitter();
        this.onDidChange = this.#onDidChange.event;

        // Компиляция схем, получение карты секций window-конфигурации
        this.#windowConfigSchema = createSchema<WindowConfig>(WINDOW_SCHEMA);
        this.#sectionsByKey = collectSections<WindowConfig>(this.#windowConfigSchema);

        this.#onDidDisposed = new EventEmitter();
        this.onDidDisposed = this.#onDidDisposed.event;


        this.#disposables = [
            // events
            this.#onDidChange,
            this.#onDidDisposed,
            // ----------------------------------
            workspace.onDidChangeConfiguration((event) => {

                if (this.#disposed) {
                    return;
                }

                logOutputChannel?.trace(`${this.constructor.name}: Configuration changed…`);

                const baseSectionChanged = event.affectsConfiguration(this.#baseConfigSection);

                if (!baseSectionChanged) {
                    logOutputChannel?.trace('  Change does not affect extension settings. Ignoring.');
                    return;
                }

                const changes = new Set<ConfigKey>();

                // Гранулярный трекинг: для каждого WindowConfigKey определяем, затронула ли
                // хоть одна из принадлежащих ему секций конфигурации текущее событие.
                // Позволяет подписчикам фильтровать нерелевантные обновления window-конфигурации.
                for (const [key, sectionSet] of this.#sectionsByKey) {
                    for (const section of sectionSet) {
                        if (event.affectsConfiguration(`${this.#baseConfigSection}.${section}`)) {
                            changes.add(key);
                            break;
                        }
                    }
                }

                // Только если есть изменения в window-конфигурации
                // (то что внесено в схему)
                if (changes.size < 1) {
                    logOutputChannel?.trace('  Change does not affect any window settings. Ignoring.');
                    return;
                }

                this.#updateWindowConfiguration();
                this.#onDidChange.fire(changes);
            })
        ];

        this.#updateWindowConfiguration();

        assert.ok(this.#configuration);
    }


    public dispose() {

        if (this.#disposed) {
            return;
        }

        this.#disposed = true;

        this.#disposables.forEach(function (d) {
            d.dispose();
        });

        this.#onDidDisposed.fire();

        this.#logOutputChannel?.trace(`${this.constructor.name}: disposed`);
    }

    get disposed() {
        return this.#disposed;
    }

    /** Получить "общих" настроек (для суб-модулей). */
    public getConfig<K extends ConfigKey>(key: K): Immutable<WindowConfig[K]> {
        assert.equal(this.#disposed, false, `${this.constructor.name}#getConfig: has been disposed`);
        return this.#configuration[key];
    }

    public get availableKeys(): Immutable<Array<ConfigKey>> {
        return [...this.#sectionsByKey.keys()];
    }


    #updateWindowConfiguration() {
        this.#configuration = readWindowConfig(
            this.#baseConfigSection,
            this.#windowConfigSchema
        );
    }

}
