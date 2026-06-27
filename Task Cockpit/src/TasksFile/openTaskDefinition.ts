import {
    workspace,
    window,
    Selection,
    TextEditorRevealType
} from 'vscode';
import * as JSONC from 'jsonc-parser';
import type TaskName from '../TaskName/TaskName';
import type TaskSource from '../Scope/TaskSource/TaskSource';


/** Открывает файл задачи в редакторе, выделяет и центрирует задачу в файле.
 *
 * При наличии дубликатов (несколько определений с одинаковым label)
 * выделяет последнее вхождение — повторяет поведение VS Code.
 *
 * @throws { Error } При любых невосстановимых ошибках.
 * @throws { ?StaleDefinitionError? } Если задача не нашлась в файле, но он не сохранен.
 *   (Полезно показать пользователю как причину для "ничего не произошло") */
async function openTaskDefinition(taskSource: TaskSource, taskName: TaskName): Promise<void> {

    const document = await workspace.openTextDocument(taskSource.uri);

    // Берем последнюю локацию (может быть несколько)
    const offset =
        locateTask(
            document.getText(),
            taskSource.JSONPath,
            taskName
        ).at(-1);

    if (!offset) {
        if (document.isDirty) {
            throw new Error(`Task "${taskName}" not found in "${workspace.asRelativePath(taskSource.uri)}" (file has unsaved changes)`);
        }
        throw new Error(`Task "${taskName}" not found in "${workspace.asRelativePath(taskSource.uri)}"`);
    }

    // Открываем в редакторе
    const editor = await window.showTextDocument(document, {
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
    // @todo: А теперь (после реорганизации вызовов)?

    // Выделяем задачу и центрируем в редакторе
    editor.revealRange(
        editor.selection = new Selection(
            document.positionAt(offset.start),
            document.positionAt(offset.end)
        ),
        TextEditorRevealType.InCenter
    );

}


function locateTask(
    content: string,
    jsonPath: ReadonlyArray<JSONC.Segment>,
    targetLabel: string
): ReadonlyArray<{ start: number; end: number; }> {

    // Строим JSON-дерево для навигации по структуре документа и получения позиций узлов
    const jsoncTree = JSONC.parseTree(content, undefined, {
        allowEmptyContent: true,
        allowTrailingComma: true
    });

    const offsets: Array<{ start: number; end: number; }> = [];

    if (!jsoncTree) {
        return offsets;
    }

    const tasksArrayNode = JSONC.findNodeAtLocation(jsoncTree, [...jsonPath]);

    if (!tasksArrayNode?.children) {
        return offsets;
    }

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

        // Метка валидна и совпадает
        if (label === targetLabel) {

            // Накапливаем: одна метка может встречаться несколько раз (дубликаты)
            offsets.push({
                start: taskNode.offset,
                end: taskNode.offset + taskNode.length
            });
        }
    }

    return offsets;
}


export default openTaskDefinition;
