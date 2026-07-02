
import * as JSONC from 'jsonc-parser';
import {
    type Diagnostic,
    type Range as VscRange,
    DiagnosticSeverity
} from 'vscode';


type TaskLabel = string;
interface Range { start: number; end: number; }


/** Находит в JSON-массиве определений задач метки, которые повторяются.
 *
 * @param taskNodes узел, соответствующий массиву задач в JSON-дереве

 * @throws { never }  функция никогда не выбрасывает исключений.
 * */
function collectDiagnostics(
    taskNodes: ReadonlyArray<Readonly<JSONC.Node>>,
    rangeMapper: (range: Range) => VscRange
): ReadonlyArray<Readonly<Diagnostic>> {

    // Все метки, встреченные в массиве (включая неповторяющиеся)
    const rangesByLabel = new Map<TaskLabel, Array<Range>>();

    for (const taskNode of taskNodes) {

        const labelNode = JSONC.findNodeAtLocation(taskNode, ['label']);

        // Определение задачи без поля "label" и не корректные определения — пропускаем
        if (!labelNode || labelNode.type !== 'string') {
            continue;
        }

        const label = labelNode.value as string;

        // Запоминаем позицию только самого значения label
        const range = {
            start: labelNode.offset,
            end: labelNode.offset + labelNode.length
        };

        // Группируем все вхождения одной метки
        const ranges = rangesByLabel.get(label);
        if (ranges) {
            ranges.push(range);
        } else {
            rangesByLabel.set(label, [range]);
        }

    }

    const diagnostics: Diagnostic[] = [];

    for (const [taskLabel, ranges] of rangesByLabel) {
        if (ranges.length > 1) {
            for (const range of ranges) {
                diagnostics.push(
                    buildDiagnostic(
                        taskLabel,
                        ranges.length,
                        rangeMapper(range)
                    )
                );
            }
        }
    }

    return diagnostics;
}


function buildDiagnostic(
    dupLabel: TaskLabel,
    count: number,
    range: VscRange
): Diagnostic {
    return {
        message: `Task "${dupLabel}" defined ${count} times.`,
        range,
        severity: DiagnosticSeverity.Warning,
        source: 'task-cockpit',
        code: 'duplicate labels'
    };
}


export default collectDiagnostics;
