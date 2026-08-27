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
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
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
    logChannel.appendLine('-'.repeat(80));
    logChannel.show();
    await run(context.subscriptions, logChannel, traceChannel);
}
function deactivate() { }
// ----------------------------------------------
async function run(subscriptions, logChannel, traceChannel) {
    subscriptions.push(vscode.tasks.onDidStartTaskProcess((e) => {
        const task = e.execution.task;
        const scope = resolveScopeString(task);
        const execution = task.execution;
        let command = '';
        if (execution instanceof vscode.ShellExecution) {
            command = execution.commandLine ?? 'no command';
        }
        else if (execution instanceof vscode.ProcessExecution) {
            command = execution.process;
        }
        logChannel.appendLine(' ');
        logChannel.appendLine(`  started task: "${task.name}" scope: ${scope} source: ${task.source} command: "${command}"`);
    }));
    const def = { type: 'shell' };
    const globalTask = new vscode.Task(def, vscode.TaskScope.Global, 'test-global', 'task-cockpit', new vscode.ShellExecution('echo hello-global'));
    const workspaceTask = new vscode.Task(def, vscode.TaskScope.Workspace, 'test-workspace', 'task-cockpit', new vscode.ShellExecution('echo hello-workspace'));
    await vscode.tasks.executeTask(globalTask);
    await vscode.tasks.executeTask(workspaceTask);
}
function resolveScopeString(task) {
    return task.scope
        ? typeof task.scope === 'number'
            ? vscode.TaskScope[task.scope]
            : task.scope.name
        : 'undefined';
}
//# sourceMappingURL=extension.js.map