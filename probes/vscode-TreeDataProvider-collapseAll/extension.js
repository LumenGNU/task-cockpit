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
        children;
        constructor(label, children = []) {
            super(label, children.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None);
            this.children = children;
            this.id = label;
        }
    }
    const emitter = new vscode.EventEmitter();
    subscriptions.push(emitter);
    let roots = [];
    const buildTree = () => {
        roots = [
            new Item('scope-a', [new Item('a-task-1'), new Item('a-task-2'), new Item('a-task-3')]),
            new Item('scope-b', [new Item('b-task-1'), new Item('b-task-2')]),
            new Item('scope-c', [new Item('c-task-1')]),
        ];
    };
    const provider = {
        onDidChangeTreeData: emitter.event,
        getTreeItem: (e) => e,
        getChildren: (e) => e ? e.children : roots,
        getParent: (e) => roots.find(r => r.children.includes(e)) ?? null,
    };
    const treeView = vscode.window.createTreeView('sandbox_view', { treeDataProvider: provider });
    subscriptions.push(treeView);
    const doExpand = (label, midFlightRefresh) => {
        logChannel.appendLine(`\n[${label}]`);
        const snapshot = [...roots];
        snapshot.forEach(e => {
            void treeView.reveal(e, { expand: 3, focus: false, select: false })
                .then(() => logChannel.appendLine(`  resolved: ${e.label}`), (err) => {
                traceChannel.trace(`[TreeView]#expandAll: reveal skipped: ${err}.`);
                logChannel.appendLine(`  skipped (→ trace): ${e.label}`);
            });
        });
        if (midFlightRefresh) {
            logChannel.appendLine('  → refresh fired mid-flight');
            buildTree();
            emitter.fire();
        }
    };
    buildTree();
    emitter.fire();
    subscriptions.push(vscode.commands.registerCommand('sandbox.expandAllMidFlight', () => {
        doExpand('expandAll — mid-flight refresh', true);
    }), vscode.commands.registerCommand('sandbox.collapseAll', () => {
        logChannel.appendLine('\n[collapseAll]');
        void vscode.commands.executeCommand('workbench.actions.treeView.sandbox_view.collapseAll');
        logChannel.appendLine('  command fired');
    }), vscode.commands.registerCommand('sandbox.expandAll', () => {
        logChannel.appendLine('\n[collapseAll]');
        void vscode.commands.executeCommand('sandbox_view.expandAll');
        logChannel.appendLine('  command fired');
    }));
    logChannel.appendLine('ready. commands:');
    logChannel.appendLine('  sandbox.expandAll');
    logChannel.appendLine('  sandbox.expandAllMidFlight');
    logChannel.appendLine('  sandbox.collapseAll');
    void vscode.commands.executeCommand("sandbox_view.focus");
}
//# sourceMappingURL=extension.js.map