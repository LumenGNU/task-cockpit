import {
    CancellationError,
    EventEmitter,
    LogOutputChannel,
    ThemeColor,
} from 'vscode';
import WindowConfiguration from '../WindowConfiguration/WindowConfiguration';

import type {
    CancellationToken,
    Disposable,
    Event,
    FileDecoration,
    FileDecorationProvider as VscFileDecorationProvider,
    ProviderResult,
    Uri,
} from 'vscode';
import type Config from '../WindowConfiguration/Config';
import type Safe from '../utils/Safe';
import type UriQuery from './UriQuery';
import type UriSchema from './UriSchema';


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

    readonly #configuration: Safe<WindowConfiguration>;

    #conf: FileDecorationConf;

    #disposables: Disposable[];

    #disposed: boolean;

    #logOutputChannel: Safe<LogOutputChannel> | null;

    // ---------------
    readonly #themeColorCache: Map<string, ThemeColor>;

    /**Создаёт провайдер.
     * @param configurationProvider начальные значения конфигурации декораций. */
    constructor(
        configuration: Safe<WindowConfiguration>,
        logOutputChannel: Safe<LogOutputChannel> | null = null
    ) {
        this.#disposed = false;

        this.#logOutputChannel = logOutputChannel;

        this.#disposables = [];

        this.#onDidChangeFileDecorations = new EventEmitter();
        this.onDidChangeFileDecorations = this.#onDidChangeFileDecorations.event;

        this.#themeColorCache = new Map();

        // conf ---
        this.#configuration = configuration;

        this.#disposables.push(
            this.#configuration.onDidChange((affectedKeys) => {
                if (!affectedKeys.has(CONFIGURATION_KEY)) {
                    return;
                }
                this.#conf = this.#configuration.getConfig(CONFIGURATION_KEY);
                this.#themeColorCache.clear(); // на всякий случай
                this.#onDidChangeFileDecorations.fire(undefined);
            }),

            // event
            this.#onDidChangeFileDecorations
        );
        this.#conf = this.#configuration.getConfig(CONFIGURATION_KEY);
        // ---

    }


    /** Освобождает ресурсы провайдера. Повторный вызов безопасен. */
    dispose() {
        if (this.#disposed) {
            return;
        }
        this.#disposed = true;
        this.#themeColorCache.clear();
        this.#disposables.forEach(function (d) {
            d.dispose();
        });
        this.#logOutputChannel?.trace(`${this.constructor.name}: disposed`);
        this.#logOutputChannel = null;
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
    provideFileDecoration(uri: Uri, token: CancellationToken): ProviderResult<FileDecoration> {

        if (this.#disposed) {
            return;
        }

        if (token.isCancellationRequested) {
            throw new CancellationError();
        }


        // see: UriSchema.d.ts
        if (uri.scheme !== 'task-cockpit' satisfies UriSchema['scheme']
            || uri.authority !== 'Node' satisfies UriSchema['authority']) {
            return undefined;
        }

        const query = new URLSearchParams(uri.query) as { get: (key: keyof UriQuery) => string | null; };

        const available: UriQuery['available'] = query.get('available') || '0';
        const running: UriQuery['running'] = query.get('running') || '0';
        const color: UriQuery['tintColor'] = query.get('tintColor') || '';

        if (available === '0' && running === '0' && color === '') {
            // не нужен ни бейдж, ни цвет
            return undefined;
        }

        let runningBadge = '';

        if (running !== '0') {

            const countSymbol = running === '1'
                ? ''
                : running.length > 1
                    ? this.#conf.overflowSymbol
                    : running;

            runningBadge =
                this.#conf.badgeOrder === 'symbolFirst'
                    ? `${this.#conf.runningSymbol}${countSymbol}`
                    : `${countSymbol}${this.#conf.runningSymbol}`;
        }

        return {
            color: color ? this.#getOrCreateThemeColor(color) : undefined,
            // Большой `runningSymbol` если есть "активные", `availableSymbol` если нет, но есть "терминалы".
            // Цифра если running>1; знак `overflowSymbol` если running>9. (badge в VS Code — строго не более двух символов)
            badge: runningBadge || (available !== '0' ? this.#conf.availableSymbol : undefined),
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

}


export default FileDecorationProvider;
