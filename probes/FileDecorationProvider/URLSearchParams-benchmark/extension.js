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
const perf_hooks_1 = require("perf_hooks");
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
    const query = 'available=5&running=2&tintColor=charts.red';
    const N = 100_000;
    // --- URLSearchParams ---
    let t0 = perf_hooks_1.performance.now();
    for (let i = 0; i < N; i++) {
        const p = new URLSearchParams(query);
        p.get('available');
        p.get('running');
        p.get('tintColor');
    }
    logChannel.appendLine(`URLSearchParams: ${perf_hooks_1.performance.now() - t0} ms`);
    // --- manual ---
    t0 = perf_hooks_1.performance.now();
    for (let i = 0; i < N; i++) {
        parseUriQuery(query); // твой вариант
    }
    logChannel.appendLine(`manual: ${perf_hooks_1.performance.now() - t0} ms`);
    await new Promise(r => setTimeout(r, 5_000));
    logChannel.appendLine(measure('URLSearchParams', () => {
        const p = new URLSearchParams(query);
        p.get('available');
        p.get('running');
        p.get('tintColor');
    }));
    // пауза между прогонами, чтобы GC успел отработать остатки первого
    await new Promise(r => setTimeout(r, 5_000));
    logChannel.appendLine(measure('manual', () => {
        parseUriQuery(query);
    }));
}
function parseUriQuery(query) {
    let available = null;
    let running = null;
    let tintColor = null;
    let start = 0;
    while (start <= query.length) {
        const ampIdx = query.indexOf('&', start);
        const end = ampIdx === -1 ? query.length : ampIdx;
        const eqIdx = query.indexOf('=', start);
        if (eqIdx !== -1 && eqIdx < end) {
            const key = query.slice(start, eqIdx);
            const val = query.slice(eqIdx + 1, end);
            if (key === 'available')
                available = val;
            else if (key === 'running')
                running = val;
            else if (key === 'tintColor')
                tintColor = val;
        }
        if (ampIdx === -1)
            break;
        start = ampIdx + 1;
    }
    return { available, running, tintColor };
}
const query = 'available=5&running=2&tintColor=charts.red';
const N = 100_000;
function measure(label, fn) {
    let gcCount = 0;
    let gcDuration = 0;
    const obs = new perf_hooks_1.PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            gcCount++;
            gcDuration += entry.duration;
        }
    });
    obs.observe({ entryTypes: ['gc'] });
    const t0 = perf_hooks_1.performance.now();
    for (let i = 0; i < N; i++)
        fn();
    const elapsed = perf_hooks_1.performance.now() - t0;
    obs.disconnect();
    return `${label}: ${elapsed.toFixed(2)}ms | GC runs: ${gcCount} | GC time: ${gcDuration.toFixed(2)}ms`;
}
//# sourceMappingURL=extension.js.map