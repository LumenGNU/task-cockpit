/** @file TasksSource/openTaskDefinitionInEditor.ts */

import {
    Selection,
    TextEditorRevealType,
    window,
    workspace
} from 'vscode';
import findTaskDefinitionRange from './findTaskDefinitionRange';

import type {
    TextEditor
} from 'vscode';
import type Immutable from '../utils/Immutable';
import type TaskName from '../TaskName';
import type TaskSource from '../ResourceStateCoordinator/TaskSource';


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

    const selectedRange =
        findTaskDefinitionRange(
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
        // курсор в начале определения.
        // В случае InCenter и выделенная область не умещается —
        // при прядке start,end курсор будет вне области отображения
        editor.document.positionAt(selectedRange.end),
        editor.document.positionAt(selectedRange.start)
    );
    editor.revealRange(editor.selection, TextEditorRevealType.InCenter);

}


export default openTaskDefinitionInEditor;
