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
    class Item extends vscode.TreeItem {
        constructor(label) {
            super(label, vscode.TreeItemCollapsibleState.None);
            this.id = label;
        }
    }
    const emitter = new vscode.EventEmitter();
    subscriptions.push(emitter);
    let items = [];
    const provider = {
        onDidChangeTreeData: emitter.event,
        getTreeItem: (e) => e,
        getChildren: () => [...items],
        getParent: () => null,
    };
    // ← сюда вставь свой viewId из package.json
    const treeView = vscode.window.createTreeView('sandbox.view', {
        treeDataProvider: provider,
    });
    subscriptions.push(treeView);
    const target = new Item('ghost');
    const reveal = async (label) => {
        logChannel.appendLine(`\n[${label}]`);
        logChannel.appendLine(`  items in tree: [${items.map(i => i.label).join(', ') || 'empty'}]`);
        try {
            await treeView.reveal(target, { select: false, expand: false });
            logChannel.appendLine('  reveal → resolved');
        }
        catch (e) {
            logChannel.appendLine(`  reveal → rejected: ${e}`);
        }
    };
    const refresh = async (label) => {
        emitter.fire();
        // даём VS Code переварить refresh
        await delay(300);
        logChannel.appendLine(`  [refreshed: ${label}]`);
    };
    // --- тесты ---
    // 1. элемент есть — baseline
    items = [target];
    await refresh('add target');
    await reveal('item present');
    // 2. убрали из массива, refresh НЕ делали
    items = [];
    await reveal('removed, no refresh');
    // 3. убрали + refresh
    await refresh('refresh after remove');
    await reveal('removed + refreshed');
    // 4. элемент никогда не был в дереве (новый инстанс)
    items = [];
    await refresh('empty tree');
    const stranger = new Item('stranger');
    logChannel.appendLine('\n[item never in tree]');
    try {
        await treeView.reveal(stranger, { select: false, expand: false });
        logChannel.appendLine('  reveal → resolved');
    }
    catch (e) {
        logChannel.appendLine(`  reveal → rejected: ${e}`);
    }
    logChannel.appendLine('\n--- done ---');
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=extension.js.map