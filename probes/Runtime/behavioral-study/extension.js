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
    logChannel.show();
    logChannel.appendLine('-'.repeat(80));
    await run(context.subscriptions, logChannel, traceChannel);
}
function deactivate() { }
// ----------------------------------------------
const startedExecutions = new Set();
async function run(subscriptions, logChannel, traceChannel) {
    const pidMap = new Map();
    const snap = vscode.tasks.taskExecutions;
    logChannel.appendLine(`[init] running tasks: ${snap.length}`);
    for (const ex of snap) {
        logChannel.appendLine(`  » ${printTask(ex.task)}`);
    }
    logChannel.appendLine('-'.repeat(40));
    subscriptions.push(vscode.tasks.onDidStartTask(e => {
        startedExecutionsAdd(e.execution, logChannel);
        logChannel.appendLine(`[startTask]    set.size=${startedExecutions.size}  taskExecutions.length=${vscode.tasks.taskExecutions.length}  ${printTask(e.execution.task)}`);
    }), vscode.tasks.onDidEndTask(e => {
        startedExecutions.delete(e.execution);
        logChannel.appendLine(`[endTask]      set.size=${startedExecutions.size}  taskExecutions.length=${vscode.tasks.taskExecutions.length}  ${printTask(e.execution.task)}`);
    }), vscode.tasks.onDidStartTaskProcess(e => {
        pidMap.set(e.execution, e.processId);
        logChannel.appendLine(`[startProcess] pid=${e.processId}  ${printTask(e.execution.task)}`);
    }), vscode.tasks.onDidEndTaskProcess(e => {
        const pid = pidMap.get(e.execution);
        pidMap.delete(e.execution);
        logChannel.appendLine(`[endProcess]   pid=${pid ?? '?'}  exitCode=${e.exitCode}  ${printTask(e.execution.task)}`);
    }));
}
function startedExecutionsAdd(execution, logChannel) {
    if (startedExecutions.has(execution)) {
        logChannel.appendLine(`execution для ${execution.task.name} уже есть`);
    }
    startedExecutions.add(execution);
}
function printTask(task) {
    const scope = task.scope === vscode.TaskScope.Global ? 'Global'
        : task.scope === vscode.TaskScope.Workspace ? 'Workspace'
            : task.scope.name;
    const command = task.execution instanceof vscode.ShellExecution
        ? (task.execution.commandLine ?? String(task.execution.command))
        : task.execution instanceof vscode.ProcessExecution
            ? task.execution.process
            : task.execution instanceof vscode.CustomExecution
                ? '(custom)'
                : '(none)';
    return `name=${JSON.stringify(task.name)}  scope=${scope}  type=${task.definition.type}  cmd=${command}`;
}
//# sourceMappingURL=extension.js.map