/** @file Workspace/Definition/Fetch.ts */
/** @module Fetch */


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


import * as JSONC from 'jsonc-parser';
import {
    CancellationError,
    CancellationToken,
    workspace as VscWorkspace
} from 'vscode';
import type Definition from '.';
import type Group from '../../type.d/Group';
import type Icon from '../../type.d/Icon';
import type TaskGroup from '../../type.d/TaskGroup';
import type TaskName from '../../type.d/TaskName';
import type TaskSource from '../TaskSource';


/** Сырой объект определения задачи, извлечённый из файла-источника.
 *
 * Поля типизированы как `unknown` — валидация выполняется
 * при преобразовании в {@linkcode mapIndex}. */
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

type DefinitionIndex = Readonly<Record<TaskName, Readonly<Definition>>>;

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
 * // @todo ~@param scope Область извлекаемых задач.~
 * @param token Токен отмены.
 *
 * @throws { CancellationError } при срабатывании токена отмены —
 *   единственное исключение, которое пробрасывается наружу. При любых
 *   других проблемах (IO, парсинг) возвращается пустая/частичная ~карта~. */
async function fetch(
    source: Readonly<TaskSource>,
    token: CancellationToken
): Promise<DefinitionIndex> {

    if (token.isCancellationRequested) {
        throw new CancellationError();
    }

    let textContent: string;
    try {
        textContent =
            new TextDecoder('utf-8', { fatal: true })
                .decode(await VscWorkspace.fs.readFile(source.uri));
    }
    catch (error) {

        // #region DEBUG
        // Отсутствие файла - нормальная ситуация
        // Проблемы с файлом/чтением/парсингом/кодировкой (или, например, там каталог - не файл) — не наши проблемы, VS Code разберётся
        const reason = error instanceof Error ? error.message : JSON.stringify(error);
        log(LogLevel.Debug, `Tasks file processing error, skipping: ${reason}`, VscWorkspace.asRelativePath(source.uri));

        // #endregion DEBUG
        // Единственное, как реагируем: "в этой области задач нет"
        // (или "не нашли", или "не смогли", или... — нам все равно: "ИХ НЕТ".
        // А за причинами обращайтесь к VS Code)
        return Object.create(null) as Readonly<DefinitionIndex>;
    }

    if (token.isCancellationRequested) {
        throw new CancellationError();
    }

    // Чтение/валидация определений задач из содержимого файла.
    // Никак не реагируем на ошибки, обслуживание файла-источника
    // задач — не наша ответственность.
    return mapIndex(
        extract(
            textContent,
            source.JSONPath
        )
    );
}


/** Извлекает массив сырых определений задач из JSONC-содержимого.
 *
 * @param jsoncContent JSONC-содержимое файла-источника задач.
 * @param jsonPath Путь к массиву задач внутри JSON-структуры.
 * @returns Массив сырых определений; пуст если путь не ведёт к массиву. */
function extract(jsoncContent: string, jsonPath: Readonly<JSONC.JSONPath>): Raw[] {

    // Парсинг JSONC
    // JSONC.parse по контракту не бросает, {@link JSONC.parse | fault-tolerant by design }.
    const parsed: unknown = JSONC.parse(
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
    const raw: unknown = jsonPath.reduce(function (node, key) {
        if (node != null && typeof node === 'object' && key in node) {
            return (node as Record<string | number, unknown>)[key];
        }
        return undefined;
    }, parsed);
    // Не массив — не наша проблема (VS Code разберётся),
    // а мы всегда возвращаем массив
    return Array.isArray(raw)
        ? raw as Raw[]
        : [] as Raw[];
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
function mapIndex(rawArr: ReadonlyArray<Raw>): Readonly<Record<TaskName, Readonly<Definition>>> {

    const index = Object.create(null) as Record<TaskName, Definition>;

    for (const raw of rawArr) {
        // Пропускаем если не объект
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {

            // Пропускаем записи без- или с невалидным названием
            // дубликаты label'ов возможны, но будут поглощены
            if (nameIsQualifies(raw.label)) {

                const definition = Object.create(null) as Definition;
                definition.hidden = parseHidden(raw.hide);
                definition.isBackground = parseIsBackground(raw.isBackground);
                definition.icon = parseIcon(raw.icon);
                definition.group = parseGroup(raw.group);

                index[raw.label] = definition;
            }
        }
    }

    return index;
}


// #region Валидаторы/парсеры


/** Проверяет, что значение является непустой строкой
 * и может использоваться как ключ. */
function nameIsQualifies(raw: unknown): raw is TaskName {
    return typeof raw === 'string' && raw.length > 0;
}


/** Разбирает сырое значение `group` из файла-источника.
 *
 * Допустимые формы:
 * - строка — преобразуется в объект с `isDefault: false`;
 * - объект с полем `kind` — извлекается `kind` и `isDefault`.
 *
 * @returns `null` при отсутствии или невалидном значении. */
function parseGroup(raw: unknown): TaskGroup | null {

    if (raw == null) {
        return null;
    }

    if (typeof raw === 'string') {
        return { kind: capitalizeKind(raw), isDefault: false };
    }

    if (typeof raw === 'object' && 'kind' in raw && typeof raw.kind === 'string') {

        return {
            kind: capitalizeKind(raw.kind),
            isDefault: 'isDefault' in raw && raw.isDefault === true
        };
    }

    return null;
}


/** Приводит первую букву `kind` к верхнему регистру
* (`"build"` → `"Build"`). */
function capitalizeKind(kind: string): Group {
    return kind.charAt(0).toUpperCase() + kind.slice(1) as Group;
}


/** Разбирает сырое значение `icon` из файла-источника.
 *
 * Ожидает объект с необязательными полями `id` (codicon)
 * и `color` (ThemeColor). Хотя бы одно должно присутствовать.
 *
 * @returns `null` если не объект или оба поля отсутствуют. */
function parseIcon(raw: unknown): Icon | null {

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

export default fetch;
