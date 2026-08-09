import {
    EventEmitter,
    workspace,
    LogOutputChannel,
} from 'vscode';
import * as assert from 'node:assert/strict';
import WindowConfigurationSchema from './WindowConfigurationSchema';
import Configuration from '../Configuration';

import type {
    Disposable,
    Event,
} from 'vscode';
import type Immutable from '../utils/Immutable';
import type Safe from '../utils/Safe';
import type WindowConfig from './Config';


type ConfigKey = WindowConfiguration.ConfigKey;
type AffectedKeys = WindowConfiguration.AffectedKeys;

declare namespace WindowConfiguration {

    export type ConfigKey = WindowConfigurationSchema.ConfigKey;
    export type AffectedKeys = Set<ConfigKey>;
}

class WindowConfiguration implements Disposable {


    readonly #onDidChange: EventEmitter<Immutable<AffectedKeys>>;
    readonly onDidChange: Event<Immutable<AffectedKeys>>;

    readonly #onDidDisposed: EventEmitter<void>;
    readonly onDidDisposed: Event<void>;

    #logOutputChannel: Safe<LogOutputChannel> | null;

    readonly #disposables: Disposable[];
    #disposed: boolean;

    /** Кеш window-конфигурации */
    #configuration!: Immutable<WindowConfig>;


    #pendingChanges: Set<ConfigKey>;
    #debounceTimer: ReturnType<typeof setTimeout> | undefined;


    static readonly #DEBOUNCE_MS = 350;

    constructor(
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {

        this.#disposed = false;

        this.#logOutputChannel = logOutputChannel;

        this.#onDidChange = new EventEmitter();
        this.onDidChange = this.#onDidChange.event;


        this.#onDidDisposed = new EventEmitter();
        this.onDidDisposed = this.#onDidDisposed.event;


        this.#pendingChanges = new Set();
        this.#debounceTimer = undefined;

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

                const changes = new Set<ConfigKey>();

                // Гранулярный трекинг: для каждого WindowConfigKey определяем, затронула ли
                // хоть одна из принадлежащих ему секций конфигурации текущее событие.
                // Позволяет подписчикам фильтровать нерелевантные обновления window-конфигурации.
                for (const [key, sectionSet] of WindowConfigurationSchema.SECTIONS_BY_KEY) {
                    for (const section of sectionSet) {
                        if (event.affectsConfiguration(section)) {
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

                logOutputChannel?.trace(`  Affected keys: ${[...changes.keys()].map((k) => `"${k}"`).join(', ')}. Accumulating.`);

                // каждое событие конфигурации аккумулирует ключи в #pendingChanges и перезапускает таймер.
                // Когда поток событий прерывается на ≥DEBOUNCE_MS, один fire уходит со всем накопленным Set.
                // #updateWindowConfiguration() при этом вызывается тоже один раз — в конце потока событий,
                // не на каждое событие.
                for (const key of changes) {
                    this.#pendingChanges.add(key);
                }

                clearTimeout(this.#debounceTimer);
                this.#debounceTimer = setTimeout(() => {

                    if (this.#disposed) {
                        return;
                    }

                    const accumulated = new Set(this.#pendingChanges);
                    this.#pendingChanges.clear();
                    this.#debounceTimer = undefined;

                    logOutputChannel?.trace(`${this.constructor.name}: Update and firing with accumulated keys: ${[...accumulated].map((k) => `"${k}"`).join(', ')}.`);

                    this.#updateWindowConfiguration();
                    this.#onDidChange.fire(accumulated);

                }, WindowConfiguration.#DEBOUNCE_MS);
            })
        ];

        this.#updateWindowConfiguration();

        assert.ok(this.#configuration, '?????????????????????????????');
    }


    public dispose() {

        if (this.#disposed) {
            return;
        }

        this.#disposed = true;

        clearTimeout(this.#debounceTimer);
        this.#debounceTimer = undefined;
        this.#pendingChanges.clear();

        this.#onDidDisposed.fire();

        this.#disposables.forEach(function (d) {
            d.dispose();
        });

        this.#logOutputChannel?.trace(`${this.constructor.name}: disposed`);
        this.#logOutputChannel = null;
    }

    get disposed() {
        return this.#disposed;
    }

    /** Получить "общих" настроек (для суб-модулей). */
    public getConfig<K extends ConfigKey>(key: K): Immutable<WindowConfig[K]> {
        assert.equal(this.#disposed, false, `${this.constructor.name}#getConfig: use after dispose`);
        return this.#configuration[key];
    }

    public get availableKeys(): Immutable<Array<ConfigKey>> {
        assert.equal(this.#disposed, false, `${this.constructor.name}#availableKeys: use after dispose`);
        return [...WindowConfigurationSchema.SECTIONS_BY_KEY.keys()];
    }

    #updateWindowConfiguration() {
        const workspaceConfig = workspace.getConfiguration();
        this.#configuration = Configuration.coerce(workspaceConfig, WindowConfigurationSchema.SCHEMA);
    }

}


export default WindowConfiguration;
