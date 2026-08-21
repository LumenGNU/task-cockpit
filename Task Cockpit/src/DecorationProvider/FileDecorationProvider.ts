import {
    CancellationError,
    EventEmitter,
    LogOutputChannel,
    ThemeColor
} from 'vscode';
import WindowConfiguration from '../WindowConfiguration/WindowConfiguration';

import type {
    CancellationToken,
    Disposable,
    Event,
    FileDecoration,
    FileDecorationProvider as VscFileDecorationProvider,
    ProviderResult,
    Uri
} from 'vscode';
import type Config from '../WindowConfiguration/Config';
import type LifecycleOmitted from '../utils/LifecycleOmitted';
import type UriQuery from './UriQuery';
import type UriSchema from './UriSchema';
import * as assert from 'node:assert/strict';


const CONFIGURATION_KEY = 'FileDecoration' as const;
type FileDecorationConf = Config[typeof CONFIGURATION_KEY];


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

    readonly #onDidChangeFileDecorations: EventEmitter<undefined>;

    /** {@link VscFileDecorationProvider.onDidChangeFileDecorations Событие провайдера}, происходит при изменении конфигурации. */
    public readonly onDidChangeFileDecorations: Event<undefined>;

    #conf: FileDecorationConf;

    #disposables: Disposable[];

    #disposed: boolean;

    #logOutputChannel: LifecycleOmitted<LogOutputChannel> | null;

    // ---------------
    readonly #themeColorCache: Map<string, ThemeColor>;

    readonly #dependencies: Readonly<{
        windowConfiguration: LifecycleOmitted<WindowConfiguration>;
    }>;

    /**Создаёт провайдер.
     * @param configurationProvider начальные значения конфигурации декораций. */
    constructor(
        dependencies: Readonly<{
            windowConfiguration: LifecycleOmitted<WindowConfiguration>;
        }>,
        logOutputChannel: LifecycleOmitted<LogOutputChannel> | null = null
    ) {
        this.#disposed = false;

        this.#logOutputChannel = logOutputChannel;


        this.#onDidChangeFileDecorations = new EventEmitter();
        this.onDidChangeFileDecorations = this.#onDidChangeFileDecorations.event;

        this.#themeColorCache = new Map();

        // conf ---
        this.#dependencies = dependencies;

        this.#disposables = [
            this.#onDidChangeFileDecorations
        ];

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.#dependencies.windowConfiguration.onDidChangeConfiguration(this.#changeConfigurationHandler, this, this.#disposables);

        this.#conf = this.#dependencies.windowConfiguration.getConfiguration(CONFIGURATION_KEY);
        // ---

    }


    /** Освобождает ресурсы провайдера. Повторный вызов безопасен. */
    public dispose() {
        if (this.#disposed) {
            return;
        }
        this.#disposed = true;
        this.#themeColorCache.clear();
        this.#disposables.forEach((d) => void d.dispose());
        this.#logOutputChannel?.trace(`[${this.constructor.name}]: disposed`);
        this.#logOutputChannel = null;
    }


    #changeConfigurationHandler(affectedKeys: ReadonlySet<keyof Config>) {
        if (!affectedKeys.has(CONFIGURATION_KEY)) {
            return;
        }
        this.#conf = this.#dependencies.windowConfiguration.getConfiguration(CONFIGURATION_KEY);
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

            // this.#logOutputChannel?.trace(`[${this.constructor.name}#provideFileDecoration]: Uri "${uri.toString()}" not supported, skipping`);
            return undefined;
        }

        const query = new URLSearchParams(uri.query) as { get: (key: keyof UriQuery) => string | null; };

        const available: UriQuery['available'] = query.get('available');
        const running: UriQuery['running'] = query.get('running');
        const color: UriQuery['tintColor'] = query.get('tintColor');

        // this.#logOutputChannel?.trace(`[${this.constructor.name}#provideFileDecoration]: "${uri.toString()}":`);
        // this.#logOutputChannel?.trace(`    available = ${available}`);
        // this.#logOutputChannel?.trace(`    running   = ${running}`);
        // this.#logOutputChannel?.trace(`    color     = ${color}`);

        if ((!available && !running && !color) || (available === '0' && running === '0' && !color)) {
            // не нужен ни бейдж, ни цвет
            // this.#logOutputChannel?.trace('    → undefined');
            return undefined;
        }

        // URI должен содержать оба параметра, если попал к нам
        assert.ok(available !== null && running !== null, `Malformed URI: ${uri.toString()}`);

        // this.#logOutputChannel?.trace('    → {FileDecoration}');
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
                return this.#conf.runningSymbol;
            }

            // Если длина > 1, число гарантированно ≥ 10 (overflow)
            // (предполагаем отсутствие ведущих нулей вроде "01")
            if (running.length > 1) {
                return this.#conf.badgeOrder === 'countFirst'
                    ? `${this.#conf.overflowSymbol}${this.#conf.runningSymbol}`
                    : `${this.#conf.runningSymbol}${this.#conf.overflowSymbol}`;
            }

            // running в диапазоне '2'..'9' — символ + цифра или наоборот
            return this.#conf.badgeOrder === 'countFirst'
                ? `${running}${this.#conf.runningSymbol}`
                : `${this.#conf.runningSymbol}${running}`;
        }

        // running === '0'
        if (available !== '0') {
            return this.#conf.availableSymbol;
        }

        // Оба нулевые — бейдж не нужен
        return undefined;

    }

}


export default FileDecorationProvider;
