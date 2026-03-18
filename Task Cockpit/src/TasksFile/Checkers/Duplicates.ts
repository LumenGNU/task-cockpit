/** @file TasksFile/Checkers/Duplicates.ts */
/** @module Duplicates */

import * as vscode from 'vscode';
import type * as TC from '../../types';
import locateTask from '../LocateTask';
import helpers from '../../helpers';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log } = Logger.get(module.filename);
// #endregion DEBUG


export default async function duplicates(
    uri: TC.Uri,
    token: vscode.CancellationToken
): Promise<vscode.Diagnostic[]> {

    try {
        const document = await vscode.workspace.openTextDocument(uri);

        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        if (document.isClosed) {
            return [];
        }

        const documentContent = document.getText();

        const tasksMap = locateTask(documentContent, helpers.resolveJsonPath(uri), undefined);

        // Отдаём управление после "тяжёлой" работы
        await new Promise(r => setImmediate(r));

        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        if (document.isClosed) {
            return [];
        }

        const fileDiagnostics: vscode.Diagnostic[] = [];

        for (const [taskLabel, ranges] of tasksMap) {
            if (ranges.length <= 1) {
                continue;
            }

            for (const range of ranges) {
                const diagnostic = new vscode.Diagnostic(
                    new vscode.Range(
                        document.positionAt(range.start),
                        document.positionAt(range.end)
                    ),
                    `Task "${taskLabel}" defined ${ranges.length} times. Duplicate labels may cause conflicts`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'task-cockpit';
                diagnostic.code = 'duplicate labels';
                fileDiagnostics.push(diagnostic);
            }
        }

        return fileDiagnostics;
    }
    catch (error) {
        if (error instanceof vscode.CancellationError) {
            throw error;
        }

        // #region DEBUG
        log(LogLevel.Warning,
            `Failed: ${error instanceof Error ? error.message : String(error)}`,
            uri.toString());
        // #endregion DEBUG

        return [];
    }
}
