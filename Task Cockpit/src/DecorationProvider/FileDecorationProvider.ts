import {
    CancellationError,
    EventEmitter,
    ThemeColor,
    type CancellationToken,
    type Disposable,
    type Event,
    type FileDecoration,
    type FileDecorationProvider as VscFileDecorationProvider,
    type ProviderResult,
    type Uri
} from 'vscode';
import * as assert from 'node:assert/strict';
import type Props from './Props';
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
 * - `onDidChangeFileDecorations` — эмитируется при изменении конфигурации (`props`).
 *
 * #### Жизненный цикл:
 * - Вызов `dispose()` освобождает ресурсы; дальнейшее использование методов
 *   провайдера приведёт к `assert`-ошибке.
 * */
class FileDecorationProvider implements VscFileDecorationProvider, Disposable {

    readonly #onDidChangeFileDecorations: EventEmitter<undefined>;

    /** {@link VscFileDecorationProvider.onDidChangeFileDecorations Событие провайдера}, происходит при изменении конфигурации. */
    public readonly onDidChangeFileDecorations: Event<undefined>;


    #props: Readonly<Props>;

    #disposed: boolean;

    /**Создаёт провайдер.
     * @param props начальные значения конфигурации декораций. */
    constructor(props: Readonly<Props>) {
        this.#disposed = false;

        this.#onDidChangeFileDecorations = new EventEmitter();
        this.onDidChangeFileDecorations = this.#onDidChangeFileDecorations.event;

        this.#props = this.#setProps(props);
    }


    /** Освобождает ресурсы провайдера. Повторный вызов безопасен. */
    dispose() {
        if (this.#disposed) {
            return;
        }
        this.#disposed = true;
        this.#onDidChangeFileDecorations.dispose();
    }


    /** Обновляет конфигурацию декораций и испускает {@linkcode onDidChangeFileDecorations},
     * если произошли реальные изменения.
     *
     * @param props новые значения конфигурации.
     *
     * @fires FileDecorationProvider#onDidChangeFileDecorations */
    setProps(props: Readonly<Props>): void {

        assert.equal(this.#disposed, false, 'FileDecorationProvider: use after dispose');

        if ((Object.keys(props) as ReadonlyArray<keyof Props>)
            .every(k => this.#props[k] === props[k])) {
            // diff -> no-op
            return;
        }

        this.#props = this.#setProps(props);

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
    provideFileDecoration(uri: Uri, token: CancellationToken): ProviderResult<FileDecoration> {

        assert.equal(this.#disposed, false, 'FileDecorationProvider: use after dispose');

        if (token.isCancellationRequested) {
            throw new CancellationError();
        }

        // see: src/type.d/UriSchema.d.ts
        if (uri.scheme !== 'task-cockpit' satisfies UriSchema['scheme']
            || uri.authority !== 'Node' satisfies UriSchema['authority']) {
            return undefined;
        }

        const query = new URLSearchParams(uri.query);

        const available: UriQuery['available'] = query.get('available') || '0';
        const running: UriQuery['running'] = query.get('running') || '0';
        const color: UriQuery['color'] = query.get('color') || '';

        if (`${available}${running}${color}` === '00') {
            return undefined;
        }

        let runningBadge = '';

        if (running !== '0') {

            const countSymbol = running === '1'
                ? ''
                : running.length > 1
                    ? this.#props.overflowSymbol
                    : running;

            runningBadge =
                this.#props.badgeOrder === 'symbolFirst'
                    ? `${this.#props.runningSymbol}${countSymbol}`
                    : `${countSymbol}${this.#props.runningSymbol}`;
        }

        return {
            color: color ? new ThemeColor(color) : undefined,
            // Большой `runningSymbol` если есть "активные", `availableSymbol` если нет, но есть "терминалы".
            // Цифра если running>1; знак `overflowSymbol` если running>9. (badge в VS Code — строго не более двух символов)
            badge: runningBadge || (available !== '0' ? this.#props.availableSymbol : undefined),
            propagate: false
        } as const;
    }

    #setProps(props: Readonly<Props>): Readonly<Props> {
        return { ...props };
    }
}


export default FileDecorationProvider;
