"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const openTaskDefinitionInEditor_1 = __importDefault(require("../../src/TasksSource/openTaskDefinitionInEditor"));
async function activate(context) {
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
    logChannel.appendLine(`workspace: ${vscode.workspace.name ? vscode.workspace.name : vscode.workspace.workspaceFolders?.[0] ? `"${vscode.workspace.workspaceFolders[0]?.name}"` : '(none)'}`);
    void vscode.window.showInformationMessage(`"${extName}" activated`);
    logChannel.show();
    logChannel.appendLine('-'.repeat(80));
    run(context.subscriptions, logChannel, traceChannel);
}
function deactivate() { }
// ----------------------------------------------
function run(subscriptions, logChannel, traceChannel) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        const msg = 'Нет открытого рабочего пространства';
        vscode.window.showErrorMessage(msg);
        throw new Error(msg);
    }
    const rootUri = workspaceFolders[0].uri;
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
                await (0, openTaskDefinitionInEditor_1.default)({
                    uri: vscode.Uri.joinPath(rootUri, '.vscode/tasks.json'),
                    JSONPath: ['tasks']
                }, selected.label);
            }
        }
        catch (error) {
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
//# sourceMappingURL=extension.js.map