/** @file FileDecorationProvider/FileDecorationProvider.ts */

import {
    CancellationError,
    EventEmitter,
    ThemeColor
} from 'vscode';
import WindowSettings from '../WindowSettings/WindowSettings';

import {
    CancellationToken,
    Disposable,
    Event,
    FileDecoration,
    FileDecorationProvider as VscFileDecorationProvider,
    ProviderResult,
    Uri
} from 'vscode';
import type LifecycleOmitted from '../utils/LifecycleOmitted';
import type LogOutputChannel from '../extension/LogOutputChannel';
import type UriQuery from './UriQuery';
import type UriSchema from './UriSchema';


/** Провайдер декораций (бейдж, цвет) для VS Code.
 *
 * Поддерживает URI вида: `task-cockpit://Node?available=<num>&running=<num>&color=<theme-color-name>`
 *
 * #### Поведение:
 * - Возвращает `undefined`, если URI не соответствует схеме/authority
 *   или если query не содержит значимых флагов.
 * - Если `running` !== '0' — формирует бейдж с символом выполнения и,
 *   при необходимости, счётчиком/символом переполнения.
 * - Если `running` === '0' и `available` !== '0' — показывает символ
 *   доступности.
 * - Цвет берётся из параметра `color` и применяется как `ThemeColor`.
 *
 * #### События:
 * - `onDidChangeFileDecorations` — эмитируется при изменении конфигурации (`conf`).
 *
 * #### Жизненный цикл:
 * - Вызов `dispose()` освобождает ресурсы; дальнейшее использование методов
 *   провайдера ничего не делает.
 * */
class FileDecorationProvider implements VscFileDecorationProvider, Disposable {

    static readonly CONFIGURATION_SECTION = 'FileDecoration' as const;

    readonly #onDidChangeFileDecorations: EventEmitter<undefined>;

    /** {@link VscFileDecorationProvider.onDidChangeFileDecorations Событие провайдера}, происходит при изменении конфигурации. */
    public readonly onDidChangeFileDecorations: Event<undefined>;

    #configuration: WindowSettings.Configuration[typeof FileDecorationProvider.CONFIGURATION_SECTION];

    #disposables: Disposable[];

    #disposed: boolean;

    #logOutputChannel: LifecycleOmitted<LogOutputChannel>;

    // ---------------
    readonly #themeColorCache: Map<string, ThemeColor>;

    readonly #resourceProps: Readonly<{
        windowSettings: LifecycleOmitted<WindowSettings>;
    }>;

    /**Создаёт провайдер.
     * @param configurationProvider начальные значения конфигурации декораций. */
    constructor(
        resourceProps: Readonly<{
            windowSettings: LifecycleOmitted<WindowSettings>;
        }>,
        logOutputChannel: LifecycleOmitted<LogOutputChannel>
    ) {
        this.#disposed = false;

        this.#logOutputChannel = logOutputChannel;


        this.#onDidChangeFileDecorations = new EventEmitter();
        this.onDidChangeFileDecorations = this.#onDidChangeFileDecorations.event;

        this.#themeColorCache = new Map();

        // conf ---
        this.#resourceProps = resourceProps;

        this.#disposables = [
            this.#onDidChangeFileDecorations
        ];

        this.#resourceProps.windowSettings.onDidCompleteUpdate(this.#handleConfigurationChange, this, this.#disposables);

        this.#configuration = this.#resourceProps.windowSettings.getConfiguration(FileDecorationProvider.CONFIGURATION_SECTION);
        // ---

    }


    /** Освобождает ресурсы провайдера. Повторный вызов безопасен. */
    public dispose() {
        if (this.#disposed) { return; }

        this.#disposed = true;
        this.#themeColorCache.clear();
        this.#disposables.forEach((d) => void d.dispose());

        this.#logOutputChannel.trace(`[${this.constructor.name}] disposed`);
    }

    public get disposed() {
        return this.#disposed;
    }


    #handleConfigurationChange(affectedKeys: WindowSettings.AffectedKeys) {
        if (!affectedKeys.has(FileDecorationProvider.CONFIGURATION_SECTION)) {
            return;
        }
        this.#configuration = this.#resourceProps.windowSettings.getConfiguration(FileDecorationProvider.CONFIGURATION_SECTION);
        this.#themeColorCache.clear(); // на всякий случай
        this.#onDidChangeFileDecorations.fire(undefined);
    }

    /** Возвращает {@link FileDecoration декорацию} для указанного URI или `undefined`.
     *
     * Поддерживаемые параметры URI ({@linkcode UriQuery}):
     * - `available` — строка-число, '0' означает недоступно.
     * - `running` — строка-число, '0' означает не запущено.
     * - `color` — строка-ключ ThemeColor.
     *
     * Метод вызывается и потребляется VS Code.
     *
     * Метод синхронный: не будет реагировать на токен отмены, если отмена происходит
     * в процессе работы.
     *
     * @param uri URI элемента.
     * @param token токен отмены.
     * @returns `FileDecoration` или `undefined`.
     * @throws { CancellationError } Если передан отмененный токен. */
    public provideFileDecoration(uri: Uri, token: CancellationToken): ProviderResult<FileDecoration> {

        if (this.#disposed) { return undefined; }

        if (token.isCancellationRequested) {
            throw new CancellationError();
        }

        // see: UriSchema.d.ts
        if (uri.scheme !== 'task-cockpit' satisfies UriSchema['scheme']
            || uri.authority !== 'Node' satisfies UriSchema['authority']) {

            // this.#logOutputChannel.trace(`[${this.constructor.name}#provideFileDecoration]: Uri "${uri.toString()}" not supported, skipping`);
            return undefined;
        }

        const query = new URLSearchParams(uri.query) as { get: (key: keyof UriQuery) => string | null; };

        const available: UriQuery['available'] = query.get('available');
        const running: UriQuery['running'] = query.get('running');
        const color: UriQuery['tintColor'] = query.get('tintColor');

        // this.#logOutputChannel.trace(`[${this.constructor.name}#provideFileDecoration]: "${uri.toString()}":`);
        // this.#logOutputChannel.trace(`    available = ${available}`);
        // this.#logOutputChannel.trace(`    running   = ${running}`);
        // this.#logOutputChannel.trace(`    color     = ${color}`);

        if ((!available && !running && !color) || (available === '0' && running === '0' && !color)) {
            // не нужен ни бейдж, ни цвет
            // this.#logOutputChannel.trace('    → undefined');
            return undefined;
        }

        // URI должен содержать оба параметра, если попал к нам
        // @fixme только если есть один должен быть и другой. обоих нет -- нормально
        // assert.ok(available !== null && running !== null, `Malformed URI: ${uri.toString()}`);

        // this.#logOutputChannel.trace('    → {FileDecoration}');
        return {
            color: color ? this.#getOrCreateThemeColor(color) : undefined,
            badge: this.#buildBadge(available || '0', running || '0'),
            propagate: false
        } as const;
    }

    #getOrCreateThemeColor(id: string): ThemeColor {
        let color = this.#themeColorCache.get(id);
        if (color === undefined) {
            color = new ThemeColor(id);
            this.#themeColorCache.set(id, color);
        }
        return color;
    }

    // Большой `runningSymbol` если есть "активные",
    // `availableSymbol` если нет, но есть "терминалы".
    // Цифра если running>1; знак `overflowSymbol` если running>9.
    // (badge в VS Code — строго не более двух символов)
    #buildBadge(available: string, running: string): string | undefined {

        // running имеет приоритет над available
        if (running !== '0') {
            if (running === '1') {
                // один активный — только символ
                return this.#configuration.runningSymbol;
            }

            // Если длина > 1, число гарантированно ≥ 10 (overflow)
            // (предполагаем отсутствие ведущих нулей вроде "01")
            if (running.length > 1) {
                return this.#configuration.badgeOrder === 'countFirst'
                    ? `${this.#configuration.overflowSymbol}${this.#configuration.runningSymbol}`
                    : `${this.#configuration.runningSymbol}${this.#configuration.overflowSymbol}`;
            }

            // running в диапазоне '2'..'9' — символ + цифра или наоборот
            return this.#configuration.badgeOrder === 'countFirst'
                ? `${running}${this.#configuration.runningSymbol}`
                : `${this.#configuration.runningSymbol}${running}`;
        }

        // running === '0'
        if (available !== '0') {
            return this.#configuration.availableSymbol;
        }

        // Оба нулевые — бейдж не нужен
        return undefined;

    }

}


export default FileDecorationProvider;
