import * as JSONC from 'jsonc-parser';
import type RawDiagnostic from './RawDiagnostic';
// import * as assert from 'node:assert/strict';


type TaskLabel = string;


function collectDiagnostics(
    taskNodes: Array<JSONC.Node>,
    availableNames: { has(key: string): boolean; },
): Array<RawDiagnostic> {

    const diagnostics: RawDiagnostic[] = [];

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

            diagnostics.push({
                code: 'missing dependency',
                message: `Task definition with label "${depNode.value || '«empty label»'}" was not found.`,
                position: { offset: depNode.offset, length: depNode.length }
            });
        }
    }

    return diagnostics;
}


// /** Строит одну VS Code диагностику для отсутствующей зависимости.
//  *
//  * @param taskLabel label задачи, у которой объявлена зависимость
//  * @param depLabel label зависимости, которая не найдена
//  * @param range диапазон в документе, соответствующий depLabel
//  * */
// function buildDiagnostic(
//     depLabel: TaskLabel,
//     absoluteRange: RawDiagnostic['absoluteRange']
// ): RawDiagnostic {
//     return {
//         message: `Task definition with label "${depLabel}" was not found.`,
//         absoluteRange,
//         severity: DiagnosticSeverity.Warning,
//         source: 'task-cockpit',
//         code: 'missing dependency'
//     };
// }


export default collectDiagnostics;
