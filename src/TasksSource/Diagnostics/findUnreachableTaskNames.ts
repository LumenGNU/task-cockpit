/** @file TasksSource/Diagnostics/findUnreachableTaskNames.ts */
/** @internal */

import * as JSONC from 'jsonc-parser';
import * as assert from 'node:assert/strict';
import type TaskName from '../../TaskName';
import type Immutable from '../../utils/Immutable';


/** Информация о вхождении недостижимого имени задачи. */
interface UnreachableTaskNameInfo {
    taskLabel: string;
    position: { offset: number; length: number; };
    // - `true`: имя задачи затенено определением из другой области (cross-origin)
    // - `false`: конфликт только внутри текущей области (same-origin)
    isShadowedByOtherOrigin: boolean;
}


/** Находит в JSON-массиве определений задач имена задач, которые
 * недостижимы при прямом запуске.
 *
 * @param taskNodes узел, соответствующий массиву задач в JSON-дереве
 * @param shadowedTaskNames карта проблемных имён задач: имя задачи → флаг cross-origin затенения
 *   - `true`: имя задачи затенено определением из другой области (cross-origin)
 *   - `false`: конфликт только внутри текущей области (same-origin)
 * @throws { never } функция никогда не выбрасывает исключений.
 * */
function findUnreachableTaskNames(
    taskNodes: Array<JSONC.Node>,
    shadowedTaskNames: Map<TaskName, boolean>
): Immutable<Array<UnreachableTaskNameInfo>> {

    const positionsByTaskName = new Map<TaskName, Array<{ offset: number; length: number; }>>();

    for (const taskNode of taskNodes) {

        const labelNode = JSONC.findNodeAtLocation(taskNode, ['label']);
        // Задачи без имени (label) или некорректный формат — пропускаем
        if (!labelNode || labelNode.type !== 'string') { continue; }

        const label = labelNode.value as TaskName;
        // Не является проблемным именем — пропускаем
        if (!shadowedTaskNames.has(label)) { continue; }

        // Сохраняем позицию вхождения имени задачи
        const position = { offset: labelNode.offset, length: labelNode.length };
        const positions = positionsByTaskName.get(label);
        if (positions) {
            positions.push(position);
        } else {
            positionsByTaskName.set(label, [position]);
        }
    }

    const result: Array<UnreachableTaskNameInfo> = [];

    for (const [taskLabel, positions] of positionsByTaskName) {

        const isCrossOrigin = shadowedTaskNames.get(taskLabel);
        assert.ok(isCrossOrigin !== undefined,
            `Expected cross-origin shadowing flag to be true for task name "${taskLabel}"`);

        const isSameScope = positions.length > 1;
        assert.ok(isSameScope || isCrossOrigin,
            `Expected at least one unreachable condition (same-origin duplicate or cross-origin shadowing) for task name "${taskLabel}"`);

        for (const position of positions) {
            if (isSameScope) {
                result.push({
                    position,
                    isShadowedByOtherOrigin: false,
                    taskLabel
                });
            }
            if (isCrossOrigin) {
                result.push({
                    position,
                    isShadowedByOtherOrigin: true,
                    taskLabel
                });
            }
        }
    }

    return result;
}

export default findUnreachableTaskNames;
