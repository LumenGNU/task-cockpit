"use strict";
/** @file extension.ts */
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
const ResourceStateCoordinator_1 = __importDefault(require("../../../src/ResourceStateCoordinator/ResourceStateCoordinator"));
const OriginKey_1 = __importDefault(require("../../../src/OriginKey"));
const TaskName_1 = __importDefault(require("../../../src/TaskName"));
async function activate(context) {
    const ext = context.extension;
    const extName = ext.packageJSON['displayName'];
    const log = vscode.window.createOutputChannel(extName);
    const trace = vscode.window.createOutputChannel(`${extName} - trace`, { log: true });
    context.subscriptions.push(log, trace);
    log.appendLine(section('ACTIVATED'));
    log.appendLine(`  id:        ${ext.id} ${ext.packageJSON['version']}`);
    log.appendLine(`  mode:      ${vscode.ExtensionMode[context.extensionMode]}`);
    log.appendLine(`  vscode:    ${vscode.version}`);
    log.appendLine(`  node:      ${process.version} ${process.platform} ${process.arch}`);
    log.appendLine(`  log level: ${vscode.LogLevel[trace.logLevel]}`);
    log.appendLine(`  workspace: ${workspaceName()}`);
    log.show();
    await run(context.subscriptions, log, trace);
}
async function run(subscriptions, log, trace) {
    let changeCount = 0;
    let coordinator = await initCoordinator(log, trace);
    let changeListener = subscribeChanges();
    // changeListener управляется вручную (recreate), поэтому — прокси
    subscriptions.push({ dispose: () => { changeListener.dispose(); } });
    function subscribeChanges() {
        return coordinator.onDidStateChange(async (affectedKeys) => {
            changeCount++;
            log.appendLine(section(`CHANGE #${changeCount}  ${ts()}  keys: ${[...affectedKeys].join(', ')}`));
            await printState(coordinator, log);
        });
    }
    function reg(id, fn) {
        return vscode.commands.registerCommand(id, fn);
    }
    subscriptions.push(reg('_debug.printState', async () => {
        log.appendLine(section(`MANUAL PRINT  ${ts()}`));
        await printState(coordinator, log);
    }), reg('_debug.forceFullRefresh', async () => {
        log.appendLine(rule(`force-full-refresh  ${ts()}`));
        await coordinator.forceFullRefresh();
    }), reg('_debug.recreate', async () => {
        changeListener.dispose();
        coordinator.dispose();
        log.appendLine(section(`RECREATE  ${ts()}`));
        coordinator = await initCoordinator(log, trace);
        await printState(coordinator, log);
        changeListener = subscribeChanges();
    }), vscode.tasks.onDidStartTaskProcess(async (e) => {
        const task = e.execution.task;
        const origin = await coordinator.resolveTaskOrigin(task);
        if (!origin) {
            return;
        }
        log.appendLine(rule(`TASK STARTED  ${ts()}  pid: ${e.processId}`));
        log.appendLine(`    name    : ${task.name}`);
        log.appendLine(`    origin  : ${OriginKey_1.default.resolveOriginName(origin)}`);
        log.appendLine(`    source  : ${task.source}`);
        log.appendLine(`    scope   : ${taskScopeLabel(task.scope)}`);
        log.appendLine(`    command : "${task.execution.commandLine}"`);
        log.appendLine(`    detail  : ${task.detail ?? '(none)'}`);
    }));
    log.appendLine('');
    log.appendLine('  commands:');
    log.appendLine('    _debug.printState          print current state');
    log.appendLine('    _debug.forceFullRefresh    force full refresh');
    log.appendLine('    _debug.recreate            dispose and recreate coordinator');
    log.appendLine(section(`INITIAL STATE  ${ts()}`));
    await printState(coordinator, log);
}
async function initCoordinator(log, trace) {
    log.appendLine('  creating coordinator...');
    const coordinator = await ResourceStateCoordinator_1.default.create(10_000, trace);
    log.appendLine('  coordinator ready');
    return coordinator;
}
async function printState(coordinator, log) {
    const layout = await coordinator.getProjectLayout();
    await printScope(coordinator, log, 'User', 'global', OriginKey_1.default.USER);
    if (layout.workspace) {
        await printScope(coordinator, log, layout.workspace.name, 'workspace', OriginKey_1.default.WORKSPACE);
    }
    for (const folder of layout.folders ?? []) {
        await printScope(coordinator, log, folder.name, 'folder', folder.key);
    }
}
async function printScope(coordinator, log, name, kind, key) {
    const config = await coordinator.getResourceConfig(key);
    const definitions = await coordinator.getOriginTaskDefinitions(key);
    const eligible = await coordinator.getEligibleTasks(key);
    log.appendLine('');
    log.appendLine(`  -- ${name}  [${kind}]`);
    // COnfig
    // --------------------------------------------------------------------
    // if (!config) {
    //     log.appendLine('    config: (null — scope does not exist)');
    //     return;
    // }
    //
    // log.appendLine('    config:');
    // printConfig(config, log);
    // --------------------------------------------------------------------
    log.appendLine('    tasks:');
    if (!definitions || definitions.size === 0) {
        log.appendLine('      (none)');
        return;
    }
    for (const [taskName, definitionsEntry] of definitions) {
        printTask(log, taskName, definitionsEntry, config, eligible);
    }
}
function printTask(log, taskName, definitionsEntry, config, eligible) {
    const displayName = TaskName_1.default.formatTaskName(taskName, config ? { segmentSeparator: config.Hierarchy.segmentSeparator, displaySeparator: ' > ' } : null);
    const isActive = definitionsEntry.effective != null;
    const shadowedCount = definitionsEntry.shadowed?.length ?? 0;
    if (isActive) {
        const runtimeTask = eligible?.get(taskName);
        log.appendLine(`      +  ${displayName.padEnd(18)}; ${runtimeTask ? `command: "${runtimeTask.execution.commandLine}"` : '« wrong task definition »'}`);
    }
    if (shadowedCount > 0) {
        for (let i = 0; i < shadowedCount; ++i) {
            log.appendLine(`      -  ${displayName.padEnd(18)}; « shadowed »`);
        }
    }
}
function printConfig(config, log) {
    for (const [grp, value] of Object.entries(config)) {
        if (value !== null && typeof value === 'object') {
            for (const [field, fieldValue] of Object.entries(value)) {
                log.appendLine(`      ${`${grp}.${field}`.padEnd(32)}${JSON.stringify(fieldValue)}`);
            }
        }
        else {
            log.appendLine(`      ${String(grp).padEnd(32)}${JSON.stringify(value)}`);
        }
    }
}
// --- утилиты ---
const SEP = '='.repeat(72);
const RULE = '-'.repeat(72);
function section(title) {
    return `\n${SEP}\n  ${title}\n${SEP}`;
}
function rule(title) {
    return `\n${RULE}\n  ${title}\n${RULE}`;
}
function ts() {
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const p3 = (n) => String(n).padStart(3, '0');
    return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p3(d.getMilliseconds())}`;
}
function workspaceName() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length)
        return '(none)';
    return vscode.workspace.name ? `"${vscode.workspace.name}"` : `"${folders[0].name}"`;
}
function taskScopeLabel(scope) {
    if (scope === vscode.TaskScope.Global)
        return 'Global';
    if (scope === vscode.TaskScope.Workspace)
        return 'Workspace';
    if (scope != null && typeof scope === 'object')
        return `folder:"${scope.name}"`;
    return '?';
}
function deactivate() { }
//# sourceMappingURL=extension.js.map