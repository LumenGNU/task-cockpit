/** @file TasksSource/findTaskDefinitionRange.ts */
/** @internal */

import * as JSONC from 'jsonc-parser';
import type Immutable from '../utils/Immutable';


/** Находит диапазон (offset/length) последнего встреченного узла среди детей по пути JSONPath, у которого поле 'label' равно `targetName`.
 * */
function findTaskDefinitionRange(
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

export default findTaskDefinitionRange;
