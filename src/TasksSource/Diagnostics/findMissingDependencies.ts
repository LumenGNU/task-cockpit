/** @file TasksSource/Diagnostics/findMissingDependencies.ts */
/** @internal */

import * as JSONC from 'jsonc-parser';
import type Immutable from '../../utils/Immutable';
import type TaskName from '../../TaskName';


interface MissingDependencyOccurrence {
    taskLabel: string;
    position: { offset: number; length: number; };
}


/** Находит в JSON-массиве определений задач зависимости (dependsOn),
 * которые ссылаются на имена задач, отсутствующие в текущем контексте разрешения.
 *
 * @param taskNodes узел, соответствующий массиву задач в JSON-дереве
 * @param availableTaskNames коллекция доступных имён задач (TaskName)
 * @throws { never } функция никогда не выбрасывает исключений.
 * */
function findMissingDependencies(
    taskNodes: Array<JSONC.Node>,
    availableTaskNames: Immutable<{ has(taskName: TaskName): boolean; }>
): Immutable<Array<MissingDependencyOccurrence>> {

    const missingDependencies: Array<MissingDependencyOccurrence> = [];

    for (const taskNode of taskNodes) {

        const dependsOnNode = JSONC.findNodeAtLocation(taskNode, ['dependsOn']);
        // Задача не имеет поля dependsOn — пропускаем
        if (!dependsOnNode) { continue; }

        const depNodes = dependsOnNode.type === 'array'
            ? dependsOnNode.children ?? []
            : [dependsOnNode];

        for (const depNode of depNodes) {

            // Нестроковые элементы dependsOn невалидны для tasks.json — пропускаем.
            // VS Code Doc: Variable substitution
            // Not all properties will accept variable substitution.
            // Specifically, only command, args, and options support variable substitution.
            if (depNode.type !== 'string') { continue; }

            const taskName = depNode.value as TaskName;

            // Имя доступно — зависимость может быть разрешена, пропускаем
            if (availableTaskNames.has(taskName)) { continue; }

            missingDependencies.push({
                taskLabel: taskName || '«empty label»',
                position: { offset: depNode.offset, length: depNode.length }
            });
        }
    }

    return missingDependencies;
}


export default findMissingDependencies;
