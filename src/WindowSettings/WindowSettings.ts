/** @file WindowSettings/WindowSettings.ts */

import {
    EventEmitter,
    workspace
} from 'vscode';
import * as assert from 'node:assert/strict';
import Configuration from '../Configuration';
import SCHEMA from './WindowConfigurationSchema';

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

    /** Ключ секции window-конфигурации.
     * Соответствует ключам типа {@linkcode WindowConfiguration}. */
    export type ConfigKey = keyof WindowConfiguration;

    /** Набор ключей конфигурации, затронутых событием изменения.
     * Передаётся подписчикам события {@linkcode WindowSettings.onDidChangeConfiguration}. */
    export type AffectedKeys = Immutable<Set<ConfigKey>>;

    /** Полный снимок window-конфигурации. */
    export type Configuration = Immutable<WindowConfiguration>;

}


/** Управляет window-конфигурацией расширения.
 *
 * - Кеширует результат `workspace.getConfiguration()` + `Configuration.coerce`.
 * - Слушает `workspace.onDidChangeConfiguration` и определяет, какие именно
 *   ключи схемы были затронуты.
 * - Накапливает изменения конфигурации с задержкой (по умолчанию 350 ms),
 *   после чего один раз обновляет кеш и уведомляет подписчиков
 *   через `onDidChangeConfiguration` с накопленным набором ключей.
 *
 * Реализует {@linkcode Disposable}. После `dispose()` все публичные методы
 * выбрасывают ошибку. */
class WindowSettings implements Disposable {

    /** Карта «ключ конфигурации → набор секций VS Code»,
     * построенная из схемы при загрузке модуля. */
    static readonly #SECTIONS_BY_KEY = Configuration.collectSections(SCHEMA);

    readonly #onDidChangeConfiguration: EventEmitter<AffectedKeys>;

    /** Событие изменения window-конфигурации.
     * В аргументе — набор реально затронутых ключей (после debounce). */
    readonly onDidChangeConfiguration: Event<AffectedKeys>;

    #logOutputChannel: LifecycleOmitted<LogOutputChannel> | null;

    readonly #disposables: Disposable[];
    #disposed: boolean;

    /** Кеш window-конфигурации */
    #configuration!: Immutable<WindowConfiguration>;

    #pendingChanges: Set<ConfigKey>;
    #debounceTimer: NodeJS.Timeout | null;

    static readonly #DEBOUNCE_MS = 350;

    /**
     * @param logOutputChannel Опциональный канал логирования.
     */
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

        this.#disposables.forEach((d) => void d.dispose());

        this.#logOutputChannel?.trace(`[${this.constructor.name}] disposed`);
        this.#logOutputChannel = null;
    }

    /** `true`, если экземпляр уже был уничтожен через {@linkcode dispose}. */
    get disposed(): boolean {
        return this.#disposed;
    }

    // #region Handlers

    #onDidChangeConfigurationHandler(event: ConfigurationChangeEvent): void {

        if (this.#disposed) { return; }

        this.#logOutputChannel?.trace(`[${this.constructor.name}] Configuration changed…`);

        const changes = new Set<ConfigKey>();

        // Гранулярный трекинг: для каждого WindowConfigKey определяем, затронула ли
        // хоть одна из принадлежащих ему секций конфигурации текущее событие.
        // Позволяет подписчикам фильтровать нерелевантные обновления window-конфигурации.
        for (const [key, sectionSet] of WindowSettings.#SECTIONS_BY_KEY) {
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

        this.#logOutputChannel?.trace(`  Affected keys: ${[...changes].map((k) => `"${k}"`).join(', ')}. Accumulating.`);

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


    /** Возвращает текущее значение указанного ключа window-конфигурации.
     *
     * @param key Ключ из схемы.
     * @returns Иммутабельное значение соответствующего поля.
     * @throws Если вызван после `dispose()`. */
    public getConfiguration<K extends ConfigKey>(key: K): Immutable<WindowConfiguration[K]> {

        assert.ok(!this.#disposed, `[${this.constructor.name}#getConfiguration]: use after dispose`);

        return this.#configuration[key];
    }


    /** Список всех доступных ключей window-конфигурации
     * (порядок соответствует порядку в схеме).
     *
     * @throws Если вызван после `dispose()`. */
    public get availableKeys(): Immutable<Array<ConfigKey>> {

        assert.ok(!this.#disposed, `[${this.constructor.name}#availableKeys]: use after dispose`);

        return [...WindowSettings.#SECTIONS_BY_KEY.keys()];
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

            this.#logOutputChannel?.trace(`[${this.constructor.name}] Update and firing with accumulated keys: ${[...accumulated].map((k) => `"${k}"`).join(', ')}.`);

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
