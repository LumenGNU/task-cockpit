import * as JSONC from 'jsonc-parser';
// import * as assert from 'node:assert/strict';
import {
    DiagnosticSeverity,
    type Diagnostic,
    type Range as VscRange,
} from 'vscode';


type TaskLabel = string;
interface Range { start: number, end: number; }


function collectDiagnostics(
    taskNodes: ReadonlyArray<Readonly<JSONC.Node>>,
    availableNames: Readonly<{ has(key: string): boolean; }>,
    rangeMapper: (range: Range) => VscRange
): ReadonlyArray<Readonly<Diagnostic>> {

    const diagnostics: Diagnostic[] = [];

    for (const taskNode of taskNodes) {

        const dependsOnNode = JSONC.findNodeAtLocation(taskNode, ['dependsOn']);
        if (!dependsOnNode) {
            // нет dependsOn поля
            continue;
        }

        const depNodes = dependsOnNode.type === 'array'
            ? dependsOnNode.children ?? []
            : [dependsOnNode];

        for (const depNode of depNodes) {
            if (depNode.type !== 'string') {
                // non-string узлы — это невалидный tasks.json, молча пропускаем
                continue;
            }

            // @reject: VS Code API: Variable substitution
            // Not all properties will accept variable substitution.
            // Specifically, only command, args, and options support variable substitution.
            // if (/\$\{[^}]+\}/.test(depNode.value)) {
            //     continue;
            // }

            // имя доступно — зависимость существует.
            if (availableNames.has(depNode.value)) {
                continue;
            }

            diagnostics.push(buildDiagnostic(
                depNode.value || '<empty label>',
                rangeMapper({ start: depNode.offset, end: depNode.offset + depNode.length })
            ));
        }
    }

    return diagnostics;
}


/** Строит одну VS Code диагностику для отсутствующей зависимости.
 *
 * @param taskLabel label задачи, у которой объявлена зависимость
 * @param depLabel label зависимости, которая не найдена
 * @param range диапазон в документе, соответствующий depLabel
 * */
function buildDiagnostic(
    // taskLabel: TaskLabel,
    depLabel: TaskLabel,
    range: VscRange,
): Diagnostic {
    return {
        message: `Task definition with label "${depLabel}" was not found.`,
        range,
        severity: DiagnosticSeverity.Warning,
        source: 'task-cockpit',
        code: 'missing dependency'
    };
}


export default collectDiagnostics;
