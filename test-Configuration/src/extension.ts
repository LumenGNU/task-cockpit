// extension.ts

import * as vscode from 'vscode';
import ConfigurationProvider from './Configuration/ConfigurationProvider';
import { CONFIG_BASE_SECTION } from './constants';
import WINDOW_SCHEMA from './Configuration/Window/SCHEMA';
import Folder from './Scope/Folder/Folder';
import getDisplayName from './Scope/getDisplayName';

export function activate(context: vscode.ExtensionContext) {

    console.log(`${context.extension.id} activated!`);

    const configuration = new ConfigurationProvider(CONFIG_BASE_SECTION);
    const outputChannel = vscode.window.createOutputChannel(`${context.extension.id} Debug`);
    context.subscriptions.push(outputChannel);

    outputChannel.show();

    // Подписка на изменения конфигурации (с выводом в канал)
    configuration.onDidChange((keys) => {
        outputChannel.appendLine('Configuration changed. Affected keys:');
        if (keys.size > 0) {
            keys.forEach((k) => outputChannel.appendLine(` - ${k}`));
        } else {
            outputChannel.appendLine(' - NONE');
        }
    });

    // Команда: показать все ключи оконной конфигурации
    context.subscriptions.push(
        vscode.commands.registerCommand('DEBUG.extension.showWindowConfig', () => {
            outputChannel.appendLine('=== Window Configuration ===');
            const windowConfigKeys = Object.keys(WINDOW_SCHEMA) as Array<keyof typeof WINDOW_SCHEMA>;
            const configObj: Record<string, unknown> = {};
            for (const key of windowConfigKeys) {
                try {
                    configObj[key as string] = configuration.readWindowConfig(key);
                } catch (err) {
                    configObj[key as string] = `Error: ${err}`;
                }
            }
            outputChannel.appendLine(JSON.stringify(configObj, null, 2));
        })
    );

    // Команда: показать ресурсную конфигурацию (глобальную и для папок)
    context.subscriptions.push(
        vscode.commands.registerCommand('DEBUG.extension.showResourceConfig', () => {
            outputChannel.appendLine('=== Resource Configuration ===');

            const scopes = [
                // @todo Global
                // **Инвариант:** `TaskScope.Workspace`, если присутствует — всегда первый.
                // workspaceFolders — в порядке полученном от VS Code.
                ...(vscode.workspace.workspaceFile ? [vscode.TaskScope.Workspace] as const : []),
                ...(vscode.workspace.workspaceFolders ?? []) as Folder[]
            ] as const;

            if (scopes) {
                for (const scope of scopes) {
                    outputChannel.appendLine(`\nTasks for ${getDisplayName(scope)}:`);
                    const folderConfig = configuration.readResourceConfig(scope);
                    outputChannel.appendLine(JSON.stringify(folderConfig, null, 2));
                }
            }
        })
    );

    // Команда: показать задачи (глобальные и для папок)
    context.subscriptions.push(
        vscode.commands.registerCommand('DEBUG.extension.showTasks', () => {
            outputChannel.appendLine('=== Tasks ===');


            const scopes = [
                // @todo Global
                // **Инвариант:** `TaskScope.Workspace`, если присутствует — всегда первый.
                // workspaceFolders — в порядке полученном от VS Code.
                ...(vscode.workspace.workspaceFile ? [vscode.TaskScope.Workspace] as const : []),
                ...(vscode.workspace.workspaceFolders ?? []) as Folder[]
            ] as const;

            // if (scopes) {
            //     for (const scope of scopes) {
            //         outputChannel.appendLine(`\nTasks for ${getDisplayName(scope)}:`);
            //         const folderTasks = configuration.readTasks(scope);

            //         outputChannel.appendLine(`Count: ${folderTasks.size}`);

            //         let i = 0;

            //         folderTasks.forEach((_taskDef, taskName) => {
            //             outputChannel.appendLine(` ${(++i).toString().padStart(3, ' ')}) ${taskName}`);
            //         });

            //         outputChannel.appendLine('---------------------------------------------');
            //     }
            // }
        })
    );

    // Команда: вывести всё сразу
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.showAllConfig', () => {
            vscode.commands.executeCommand('extension.showWindowConfig');
            vscode.commands.executeCommand('extension.showResourceConfig');
            vscode.commands.executeCommand('extension.showTasks');
        })
    );
}

export function deactivate() { }
