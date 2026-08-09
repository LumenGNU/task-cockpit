
import * as JSONC from 'jsonc-parser';
import type RawDiagnostic from './RawDiagnostic';


type TaskLabel = string;


/** Находит в JSON-массиве определений задач метки, которые повторяются.
 *
 * @param taskNodes узел, соответствующий массиву задач в JSON-дереве

 * @throws { never }  функция никогда не выбрасывает исключений.
 * */
function collectDiagnostics(
    taskNodes: Array<JSONC.Node>
): Array<RawDiagnostic> {

    // Все метки, встреченные в массиве (включая неповторяющиеся)
    const positionsByLabel = new Map<TaskLabel, Array<RawDiagnostic['position']>>();

    for (const taskNode of taskNodes) {

        const labelNode = JSONC.findNodeAtLocation(taskNode, ['label']);

        // Определение задачи без поля "label" и не корректные определения — пропускаем
        if (!labelNode || labelNode.type !== 'string') {
            continue;
        }

        const label = labelNode.value as string;

        // Запоминаем позицию только самого значения label
        const position = {
            offset: labelNode.offset,
            length: labelNode.length
        };

        // Группируем все вхождения одной метки
        const positions = positionsByLabel.get(label);
        if (positions) {
            positions.push(position);
        } else {
            positionsByLabel.set(label, [position]);
        }
    }

    const diagnostics: RawDiagnostic[] = [];

    for (const [taskLabel, positions] of positionsByLabel) {
        if (positions.length > 1) {
            for (const position of positions) {
                diagnostics.push({
                    code: 'duplicate labels',
                    message: `Task "${taskLabel}" defined ${positions.length} times.`,
                    position
                });
            }
        }
    }

    return diagnostics;
}


// function buildRawDiagnostic(
//     dupLabel: TaskLabel,
//     count: number,
//     range: RawDiagnostic['absoluteRange']
// ): RawDiagnostic {
//     return {
//         message: `Task "${dupLabel}" defined ${count} times.`,
//         absoluteRange: range,
//         severity: DiagnosticSeverity.Warning,
//         source: 'task-cockpit',
//         code: 'duplicate labels'
//     };
// }


export default collectDiagnostics;
