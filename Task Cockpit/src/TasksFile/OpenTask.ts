/** @file TasksFile/OpenTask.ts */
/** @module OpenTask */

import * as vscode from 'vscode';
import * as JSONC from 'jsonc-parser';
import type * as TC from '../types';
import helpers from '../helpers';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


class StaleDefinitionError extends Error {
    constructor(
        public readonly taskId: TC.TaskID
    ) {
        super('Task not found in file (file has unsaved changes)');
    }
}


/** Открывает файл задачи в редакторе, выделяет и центрирует задачу в файле.
 *
 * При наличии дубликатов (несколько определений с одинаковым label)
 * выделяет последнее вхождение — повторяет поведение VS Code.
 *
 * @throws {Error} При любых невосстановимых ошибках.
 * @throws {StaleDefinitionError} Если задача не нашлась в файле, но он не сохранен.
 *   (Полезно показать пользователю как причину для "ничего не произошло") */
async function openTask(taskId: TC.TaskID): Promise<void> {

    // #region DEBUG
    const taskIdStr = helpers.printTaskId(taskId);
    log(LogLevel.Debug, 'Opening task in file ...', taskIdStr);
    // #endregion DEBUG

    const { taskFile, taskName } = helpers.parseId(taskId);

    const uri = helpers.resolveUri(taskFile);

    const document = await vscode.workspace.openTextDocument(uri);

    // Берем последнюю локацию (может быть несколько)
    const offset = locateTask(document.getText(), helpers.resolveJsonPath(uri), taskName).at(-1);

    if (!offset) {
        if (document.isDirty) throw new StaleDefinitionError(taskId);
        throw new Error(`Task "${taskName}" not found in "${taskFile}"`);
    }

    // Открываем в редакторе
    const editor = await vscode.window.showTextDocument(document, {
        preserveFocus: false,
        preview: false
    });

    // // @todo: Ни от чего не защищает? @reject:
    // // Из доки {@linkcode vscode.workspace.openTextDocument}:
    // // "The lifecycle of the returned document is owned by the editor and
    // // not by the extension. That means an onDidClose-event can occur at any time
    // // after opening it."
    // if (document.isClosed) {
    //     throw new Error(`Document "${taskFile}" was closed during processing`);
    // }
    // @todo: А теперь (после организации вызовов)?

    // Выделяем задачу и центрируем в редакторе
    editor.revealRange(
        editor.selection = new vscode.Selection(
            document.positionAt(offset.start),
            document.positionAt(offset.end)
        ),
        vscode.TextEditorRevealType.InCenter
    );

    // #region DEBUG
    log(LogLevel.Debug,
        'Task located and selected in file', taskIdStr);
    // #endregion DEBUG

}



function locateTask(
    content: string,
    jsonPath: JSONC.JSONPath,
    targetLabel: string
): ReadonlyArray<{ start: number, end: number }> {

    // Строим JSON-дерево для навигации по структуре документа и получения позиций узлов
    const jsoncTree = JSONC.parseTree(content, undefined, {
        allowEmptyContent: true,
        allowTrailingComma: true,
    });

    const offsets: Array<{ start: number, end: number }> = [];

    if (!jsoncTree) {
        return offsets;
    }

    const tasksArrayNode = JSONC.findNodeAtLocation(jsoncTree, jsonPath);

    if (!tasksArrayNode?.children) {
        return offsets;
    }

    for (const taskNode of tasksArrayNode.children) {

        // Обрабатываем каждую задачу и собираем позиции для совпадающих меток
        // Не первый результат, а све — все равно придется проверить все
        // из-за возможных дубликатов

        const labelNode = JSONC.findNodeAtLocation(taskNode, ['label']);

        if (!labelNode) {
            // Задача без поля 'label', пропускаем
            continue;
        }

        const label = labelNode.value;

        // Метка валидна и совпадает
        if (helpers.isName(label) && label === targetLabel) {

            // Накапливаем: одна метка может встречаться несколько раз (дубликаты)
            offsets.push({
                start: taskNode.offset,
                end: taskNode.offset + taskNode.length
            });
        }
    }

    return offsets;
}


export default Object.assign(openTask, { StaleDefinitionError });
