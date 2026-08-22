/** @file WindowConfiguration/WindowConfiguration.ts */

import {
    EventEmitter,
    workspace
} from 'vscode';
import * as assert from 'node:assert/strict';
import Configuration from '../Configuration';
import SCHEMA from './Schema';

import type {
    ConfigurationChangeEvent,
    Disposable,
    Event,
    LogOutputChannel
} from 'vscode';
import type Immutable from '../utils/Immutable';
import type LifecycleOmitted from '../utils/LifecycleOmitted';
import type WindowConfiguration from './Configuration';


type ConfigKey = WindowSettings.ConfigKey;
type AffectedKeys = WindowSettings.AffectedKeys;


declare namespace WindowSettings {

    export type ConfigKey = keyof WindowConfiguration;
    export type AffectedKeys = Set<ConfigKey>;

    export type Configuration = WindowConfiguration;

}

class WindowSettings implements Disposable {


    static readonly SECTIONS_BY_KEY = Configuration.collectSections(SCHEMA);


    readonly #onDidChangeConfiguration: EventEmitter<Immutable<AffectedKeys>>;
    readonly onDidChangeConfiguration: Event<Immutable<AffectedKeys>>;

    #logOutputChannel: LifecycleOmitted<LogOutputChannel> | null;

    readonly #disposables: Disposable[];
    #disposed: boolean;

    /** Кеш window-конфигурации */
    #configuration!: Immutable<WindowConfiguration>;


    #pendingChanges: Set<ConfigKey>;
    #debounceTimer: NodeJS.Timeout | null;


    static readonly #DEBOUNCE_MS = 350;

    constructor(
        logOutputChannel: LifecycleOmitted<LogOutputChannel> | null = null
    ) {

        this.#disposed = false;

        this.#logOutputChannel = logOutputChannel;

        this.#onDidChangeConfiguration = new EventEmitter();
        this.onDidChangeConfiguration = this.#onDidChangeConfiguration.event;

        this.#pendingChanges = new Set();
        this.#debounceTimer = null;

        this.#disposables = [
            this.#onDidChangeConfiguration
        ];

        // eslint-disable-next-line @typescript-eslint/unbound-method
        workspace.onDidChangeConfiguration(this.#onDidChangeConfigurationHandler, this, this.#disposables);

        this.#updateCache();

        assert.ok(this.#configuration, 'Configuration cache should be initialized');
    }


    public dispose() {

        if (this.#disposed) { return; }
        this.#disposed = true;

        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }

        this.#pendingChanges.clear();


        this.#disposables.forEach(function (d) {
            d.dispose();
        });

        this.#logOutputChannel?.trace(`[${this.constructor.name}]: disposed`);
        this.#logOutputChannel = null;
    }

    get disposed(): boolean {
        return this.#disposed;
    }

    // #region Handlers

    #onDidChangeConfigurationHandler(event: ConfigurationChangeEvent): void {

        if (this.#disposed) { return; }

        this.#logOutputChannel?.trace(`[${this.constructor.name}]: Configuration changed…`);

        const changes = new Set<ConfigKey>();

        // Гранулярный трекинг: для каждого WindowConfigKey определяем, затронула ли
        // хоть одна из принадлежащих ему секций конфигурации текущее событие.
        // Позволяет подписчикам фильтровать нерелевантные обновления window-конфигурации.
        for (const [key, sectionSet] of WindowSettings.SECTIONS_BY_KEY) {
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
            this.#logOutputChannel?.trace('  Change does not affect any window settings. Ignoring.');
            return;
        }

        this.#logOutputChannel?.trace(`  Affected keys: ${[...changes.keys()].map((k) => `"${k}"`).join(', ')}. Accumulating.`);

        // каждое событие конфигурации аккумулирует ключи в #pendingChanges и перезапускает таймер.
        // Когда поток событий прерывается на ≥DEBOUNCE_MS, один fire уходит со всем накопленным Set.
        // #updateWindowConfiguration() при этом вызывается тоже один раз — в конце потока событий,
        // не на каждое событие.
        for (const key of changes) {
            this.#pendingChanges.add(key);
        }

        this.#scheduleUpdate();

    }

    // #endregion Handlers

    /** Получить "общих" настроек (для суб-модулей). */
    public getConfiguration<K extends ConfigKey>(key: K): Immutable<WindowConfiguration[K]> {

        if (this.#disposed) {
            throw new Error(`[${this.constructor.name}#getConfiguration]: use after dispose`);
        }

        return this.#configuration[key];
    }

    public get availableKeys(): Immutable<Array<ConfigKey>> {

        if (this.#disposed) {
            throw new Error(`[${this.constructor.name}#availableKeys]: use after dispose`);
        }

        return [...WindowSettings.SECTIONS_BY_KEY.keys()];
    }


    #scheduleUpdate() {

        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }

        let debounceTimer: NodeJS.Timeout;

        this.#debounceTimer = debounceTimer = setTimeout(() => {

            if (this.#disposed) { return; }
            if (debounceTimer !== this.#debounceTimer) { return; }
            this.#debounceTimer = null;

            const accumulated = new Set(this.#pendingChanges);
            this.#pendingChanges.clear();

            this.#logOutputChannel?.trace(`[${this.constructor.name}]: Update and firing with accumulated keys: ${[...accumulated].map((k) => `"${k}"`).join(', ')}.`);

            this.#updateCache();
            this.#onDidChangeConfiguration.fire(accumulated);

        }, WindowSettings.#DEBOUNCE_MS);
    }

    #updateCache() {
        const workspaceConfig = workspace.getConfiguration();
        this.#configuration = Configuration.coerce(workspaceConfig, SCHEMA);
    }

}


export default WindowSettings;
