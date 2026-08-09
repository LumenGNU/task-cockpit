import {
    workspace,
    window,
    Selection,
    TextEditorRevealType,
    type TextEditor,
    Uri
} from 'vscode';
import * as JSONC from 'jsonc-parser';
import TaskName from '../TaskName';
import type Immutable from '../utils/Immutable';


interface TaskSource {
    uri: Uri;
    JSONPath: Array<string>;
}


// "Фиксировать нарушения формата":
// Я не обслуживаю файл-источник! Не валидирую! Не проверяю на ошибки!
// Это задача VS Code, не моя!
// Я просто ищу запрошенный taskName среди определений, если они там вообще есть,
// в том виде, в каком его передали.
// Если поиск не удачен — я сообщаю только "поиск не удачен". Я не делаю предположений,
// и не ищу причины неудачи. Я не обслуживаю файл-источник!


/** Открывает файл-источник задач в редакторе, находит последнее определение задачи по label,
 * выделяет его и центрирует в редакторе.
 *
 * Поведение:
 * - Если в файле несколько задач label которых совпадает с `taskName` — выбирается
 *   последнее вхождение, что повторяет поведение VS Code.
 *
 * @throws { Error }
 *   - Если файл не может быть открыт
 *   - Если задача не найдена.
 *   - Если задача не найдена, но документ имеет несохранённые изменения.
 *   - Если документ закрыт в процессе обработки.
 * Ошибки выброшенные `openTaskDefinitionInEditor` должны быть показаны пользователю.
 * Другой реакции на них не предполагается.
 *  */
async function openTaskDefinitionInEditor(taskSource: Immutable<TaskSource>, taskName: TaskName): Promise<void> {

    let editor: TextEditor;
    try {
        // Открываем в редакторе
        editor = await window.showTextDocument(
            await workspace.openTextDocument(taskSource.uri),
            {
                preserveFocus: false,
                preview: false
            }
        );
    }
    catch (error) {
        throw new Error(`Cannot open file "${workspace.asRelativePath(taskSource.uri)}"`, { cause: error });
    }


    // Находим все диапазоны определений задачи и берём последнее
    const selectedRange =
        findTaskDefinitionRanges(
            editor.document.getText(),
            taskSource.JSONPath,
            taskName
        );


    //@reject: Сейчас не достижимо. Нужно будет если появится await выше.
    // // Из доки {@linkcode vscode.workspace.openTextDocument}:
    // // "The lifecycle of the returned document is owned by the editor and
    // // not by the extension. That means an onDidClose-event can occur at any time
    // // after opening it."
    // // Проверяем, что документ всё ещё открыт и тот же самый
    // if (editor.document.isClosed) {
    //     throw new Error(`Document "${workspace.asRelativePath(taskSource.uri)}" was closed`);
    // }

    if (!selectedRange) {
        if (editor.document.isDirty) {
            throw new Error(`Task "${taskName}" not found in "${workspace.asRelativePath(taskSource.uri)}" (file has unsaved changes)`);
        }
        throw new Error(`Task "${taskName}" not found in "${workspace.asRelativePath(taskSource.uri)}"`);
    }

    // Выделяем задачу и центрируем в редакторе
    editor.selection = new Selection(
        editor.document.positionAt(selectedRange.end),
        editor.document.positionAt(selectedRange.start)
    );
    editor.revealRange(editor.selection, TextEditorRevealType.InCenter);

}


/** Находит диапазон (offset/length) последнего встреченного узла задачи, у которого поле 'label' равно `targetName`.
 * */
function findTaskDefinitionRanges(
    content: string,
    JSONPath: Immutable<Array<JSONC.Segment>>,
    targetName: string
): Immutable<{ start: number; end: number; }> | null {

    // Строим JSON-дерево для навигации по структуре документа и получения позиций узлов
    const jsoncTree = JSONC.parseTree(content, undefined, {
        allowEmptyContent: true,
        allowTrailingComma: true
    });

    let range: { start: number; end: number; } | null = null;

    if (!jsoncTree) {
        return range;
    }

    const tasksArrayNode = JSONC.findNodeAtLocation(jsoncTree, [...JSONPath]);

    if (!tasksArrayNode?.children) {
        return range;
    }

    // одна метка может встречаться несколько раз (дубликаты)
    // ищем последнюю
    for (const taskNode of tasksArrayNode.children) {

        // Обрабатываем каждую задачу и собираем позиции для совпадающих меток
        // Не первый результат, а все — все равно придется проверить все
        // из-за возможных дубликатов

        const labelNode = JSONC.findNodeAtLocation(taskNode, ['label']);

        if (!labelNode) {
            // Задача без поля 'label', пропускаем
            continue;
        }

        const label = labelNode.value as unknown;

        // Метка совпадает.
        if (label === targetName) {

            range = {
                start: taskNode.offset,
                end: taskNode.offset + taskNode.length
            };
        }
    }

    return range;
}


export default openTaskDefinitionInEditor;
