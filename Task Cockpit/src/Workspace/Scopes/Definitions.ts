/** @file Cockpit/Workspace/Definitions.ts */
/** @module Definitions */

import * as JSONC from 'jsonc-parser';
import * as vscode from 'vscode';
import type * as TC from '../../types';
import type Definition from './Definition';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


/** Сырой объект определения задачи, извлечённый из файла-источника.
 *
 * Поля типизированы как `unknown` — валидация выполняется
 * при преобразовании в {@linkcode indexRaw}. */
interface Raw {
    /** Имя. */
    label?: unknown;
    /** Флаг скрытия. */
    hide?: unknown;
    /** Пользовательская иконка. */
    icon?: unknown;
    /** Группа (строка/объект с `kind`/`isDefault`). */
    group?: unknown;
    /** Признак фоновой. */
    isBackground?: unknown;
}


/** Массив определений задач одной области. */
type Definitions = Array<Readonly<Definition>>;


const Definitions = {

    /** Читает определения задач области из файла-источника.
     *
     * Порядок записей в результате соответствует порядку определений
     * в файле-источнике; ключ карты — значение поля `label`.
     *
     * Загружает определения задач напрямую из файла-источника.
     *
     * - Парсит файл самостоятельно.
     * - Гарантирует порядок задач как в файле.
     * - Задачи дублирующие Name — не выбрасываются.
     *
     * Не выбрасывает IO/Parsing/etc исключений — при любых ошибках чтения
     * или парсинга возвращает пустую карту. Обслуживание файла-источника
     * не наша ответственность, этим занимается VS Code.
     *
     * @param scope Область извлекаемых задач.
     * @param token Токен отмены.
     *
     * @throws {vscode.CancellationError} при срабатывании токена отмены —
     *   единственное исключение, которое пробрасывается наружу. При любых
     *   других проблемах (IO, парсинг) возвращается пустая/частичная карта. */
    async fetch(
        source: TC.TaskSource,
        token: vscode.CancellationToken
    ): Promise<Readonly<Definitions>> {

        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        try {
            var textContext =
                new TextDecoder('utf-8', { fatal: true })
                    .decode(
                        await vscode.workspace.fs.readFile(source.uri)
                    );
        }
        catch (error) {

            // #region DEBUG
            // Отсутствие файла - нормальная ситуация
            // Проблемы с файлом/чтением/парсингом/кодировкой (или, например, там каталог - не файл) — не наши проблемы, VS Code разберётся
            const reason = error instanceof Error ? error.message : JSON.stringify(error);
            log(LogLevel.Debug, `Tasks file processing error, skipping: ${reason}`, vscode.workspace.asRelativePath(source.uri));

            // #endregion DEBUG
            // Единственное, как реагируем: "в этой области задач нет"
            // (или "не нашли", или "не смогли", или... — нам все равно: "ИХ НЕТ".
            // А за причинами обращайтесь к VS Code)
            return [];
        }

        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        // Чтение/валидация определений задач из содержимого файла.
        // Никак не реагируем на ошибки, обслуживание файла-источника
        // задач — не наша ответственность.
        return indexRaw(
            extract(
                textContext,
                source.JSONPath
            )
        );
    },

} as const;


/** Извлекает массив сырых определений задач из JSONC-содержимого.
 *
 * @param jsoncContent JSONC-содержимое файла-источника задач.
 * @param jsonPath Путь к массиву задач внутри JSON-структуры.
 * @returns Массив сырых определений; пуст если путь не ведёт к массиву. */
function extract(jsoncContent: string, jsonPath: Readonly<JSONC.JSONPath>): Raw[] {

    // Парсинг JSONC
    const parsed = JSONC.parse(
        jsoncContent,
        undefined, // не собираемся обрабатывать ошибки
        {
            // настройки совместимости с VS Code
            allowEmptyContent: true,
            allowTrailingComma: true
        }
    );

    // Извлекаем массив задач по пути `jsonPath`.
    // (разный для .json и .code-workspace файлов)
    const raw = jsonPath.reduce((node, key) => {
        return node?.[key];
    }, parsed);
    // Не массив — не наша проблема (VS Code разберётся),
    // а мы всегда возвращаем массив
    return Array.isArray(raw) ? raw : [];
}


/** Преобразует сырой массив в массив определений.
 *
 * Выполняется минимальная валидация:
 * - записи, не являющиеся объектами, пропускаются;
 * - записи без `label` или с невалидным `label` пропускаются;
 *
 * - Поле `group` нормализуется: строковая форма приводится к объектной,
 *   первая буква `kind` — к верхнему регистру.
 *
 * - Поле `icon` — `null` при отсутствии или невалидном значении.
 *
 * @param rawArr {@link Raw Сырой массив определений}, извлечённый из файла-источника.
 * @returns Массив определений. */
function indexRaw(rawArr: Raw[]): Definitions {

    const result: Definitions = [];

    for (const raw of rawArr) {
        // Пропускаем если не объект
        if (raw && typeof raw === 'object') {

            // Пропускаем записи без- или с невалидным названием
            if (nameIsQualifies(raw.label)) {

                const definition = Object.create(null) as Definition;
                definition.name = raw.label;
                definition.hidden = parseHidden(raw.hide);
                definition.isBackground = parseIsBackground(raw.isBackground);
                definition.icon = parseIcon(raw.icon);
                definition.group = parseGroup(raw.group);

                // дубликаты label'ов возможны
                result.push(definition);
            }
        }
    }

    return result;
}


// #region Валидаторы/парсеры


/** Проверяет, что значение является непустой строкой
 * и может использоваться как {@linkcode Definition.Name}. */
function nameIsQualifies(raw: unknown): raw is TC.TaskName {
    return typeof raw === 'string' && raw.length > 0;
}


/** Разбирает сырое значение `group` из файла-источника.
 *
 * Допустимые формы:
 * - строка — преобразуется в объект с `isDefault: false`;
 * - объект с полем `kind` — извлекается `kind` и `isDefault`.
 *
 * @returns `null` при отсутствии или невалидном значении. */
function parseGroup(raw: unknown): TC.TaskGroup | null {

    if (raw == null) {
        return null;
    }

    if (typeof raw === 'string') {
        return { kind: capitalizeKind(raw), isDefault: false };
    }

    if (typeof raw === 'object' && 'kind' in raw && typeof raw.kind === 'string') {

        return {
            kind: capitalizeKind(raw.kind),
            isDefault: 'isDefault' in raw && raw.isDefault === true,
        };
    }

    return null;
}


/** Приводит первую букву `kind` к верхнему регистру
* (`"build"` → `"Build"`). */
function capitalizeKind(kind: string): TC.Group {
    return kind.charAt(0).toUpperCase() + kind.slice(1) as TC.Group;
}


/** Разбирает сырое значение `icon` из файла-источника.
 *
 * Ожидает объект с необязательными полями `id` (codicon)
 * и `color` (ThemeColor). Хотя бы одно должно присутствовать.
 *
 * @returns `null` если не объект или оба поля отсутствуют. */
function parseIcon(raw: unknown): TC.Icon | null {

    if (raw == null || typeof raw !== 'object') {
        return null;
    }

    const id = 'id' in raw && typeof raw.id === 'string' ? raw.id : undefined;
    const color = 'color' in raw && typeof raw.color === 'string' ? raw.color : undefined;

    return (id || color) ? { id, color } : null;
}


/** @returns `true` только если сырое значение — литерал `true`. */
function parseHidden(raw: unknown): boolean {
    return typeof raw === 'boolean' ? raw === true : false;
}


/** @returns `true` только если сырое значение — литерал `true`. */
function parseIsBackground(raw: unknown): boolean {
    return typeof raw === 'boolean' ? raw === true : false;
}

// #endregion Валидаторы/парсеры

export default Definitions;
