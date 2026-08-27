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
        const scope = resolveScopeString(task.scope);
        const execution = task.execution;
        let command = '';
        if (execution instanceof vscode.ShellExecution) {
            command = execution.commandLine ?? 'no command';
        }
        else if (execution instanceof vscode.ProcessExecution) {
            command = execution.process;
        }
        logChannel.appendLine(' ');
        logChannel.appendLine(`  started task: "${task.name}"; scope: ${scope}; source: ${task.source}; command: "${command}"`);
    }));
    logChannel.appendLine('Fetched tasks:');
    const tasksList = await vscode.tasks.fetchTasks();
    const header = ['name', 'scope'];
    logChannel.appendLine(`      ${header.map(t => t.padEnd(32)).join('  ')}`);
    logChannel.appendLine(`      ${header.map(t => t.padEnd(32).replaceAll(/./g, '-')).join('  ')}`);
    tasksList.forEach((task, index) => {
        const scope = resolveScopeString(task.scope);
        logChannel.appendLine(`  ${(index + 1).toString().padStart(2)}. ${task.name.padEnd(32)}  ${scope}`);
    });
    logChannel.appendLine(' ');
    logChannel.appendLine('Task guts:');
    tasksList.forEach((task, index) => {
        const proto = Object.getPrototypeOf(task);
        const getters = Object.getOwnPropertyNames(proto).filter(key => {
            const desc = Object.getOwnPropertyDescriptor(proto, key);
            return typeof desc?.get === 'function';
        });
        // Значения
        const snapshot = Object.fromEntries(getters.map(k => [k, task[k]]));
        function replacer(key, value) {
            if (key === 'scope') {
                const scope = value;
                return resolveScopeString(scope);
            }
            if (key === 'execution') {
                if (value instanceof vscode.ShellExecution) {
                    return 'ShellExecution';
                }
                else if (value instanceof vscode.ProcessExecution) {
                    return 'ProcessExecution';
                }
                return 'CustomExecution';
            }
            return value;
        }
        logChannel.appendLine(`  ${(index + 1).toString().padStart(2)}. ${JSON.stringify(snapshot, replacer, 4)
            .split('\n')
            .map((s, i) => i === 0 ? s : `    ${s}`)
            .join('\n')}`);
    });
    logChannel.appendLine(' ');
    logChannel.appendLine('.'.repeat(80));
}
function resolveScopeString(scope) {
    return scope
        ? typeof scope === 'number'
            ? vscode.TaskScope[scope]
            : scope.name
        : 'undefined';
}
//# sourceMappingURL=extension.js.map