import * as vscode from 'vscode';
import openTaskDefinitionInEditor from '../../src/TasksSource/openTaskDefinitionInEditor';
import TaskName from '../../src/TaskName';


export async function activate(context: vscode.ExtensionContext): Promise<void> {

    const ext = context.extension;
    const extName = ext.packageJSON['displayName'];

    const logChannel = vscode.window.createOutputChannel(extName);
    const traceChannel = vscode.window.createOutputChannel(`${extName} - trace`, { log: true });
    context.subscriptions.push(logChannel, traceChannel);

    logChannel.appendLine(`extension: ${ext.id} ${ext.packageJSON['version']}`);
    logChannel.appendLine(`mode: ${vscode.ExtensionMode[context.extensionMode]}`);
    logChannel.appendLine(`vscode: ${vscode.version}`);
    logChannel.appendLine(`node: ${process.version} ${process.platform} ${process.arch}`);
    logChannel.appendLine(`log level: ${vscode.LogLevel[traceChannel.logLevel]}`);
    logChannel.appendLine(`workspace: ${vscode.workspace.name ? vscode.workspace.name : vscode.workspace.workspaceFolders?.[0] ? `"${vscode.workspace.workspaceFolders![0]?.name}"` : '(none)'}`);

    void vscode.window.showInformationMessage(`"${extName}" activated`);
    logChannel.show();

    logChannel.appendLine('-'.repeat(80));


    run(context.subscriptions, logChannel, traceChannel);
}

export function deactivate(): void { }


// ----------------------------------------------


function run(
    subscriptions: { dispose(): any; }[],
    logChannel: vscode.OutputChannel,
    traceChannel: vscode.LogOutputChannel
) {

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        const msg = 'Нет открытого рабочего пространства';
        vscode.window.showErrorMessage(msg);
        throw new Error(msg);
    }

    const rootUri = workspaceFolders[0]!.uri;

    const items = [
        { label: 'My Task' },
        { label: 'long-long-task' },
        { label: 'not-exists' }
    ];

    const commandDisposable = vscode.commands.registerCommand('sandbox.openTaskDefinition', async () => {
        try {

            // Показываем меню выбора
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Выберите вариант',
                canPickMany: false,
                ignoreFocusOut: true
            });

            if (selected) {
                logChannel.appendLine(`Выбрано: ${selected.label}`);

                await openTaskDefinitionInEditor({
                    uri: vscode.Uri.joinPath(rootUri, '.vscode/tasks.json'),
                    JSONPath: ['tasks']
                }, selected.label as TaskName);

            }

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            traceChannel.error(`Ошибка при выполнении команды: ${message}`);
            vscode.window.showErrorMessage(`Произошла ошибка: ${message}`);
        }
    });

    logChannel.appendLine('\n');
    logChannel.appendLine('sandbox.openTaskDefinition — Открыть определение задачи');
    logChannel.appendLine('\n');

    subscriptions.push(commandDisposable);
}
