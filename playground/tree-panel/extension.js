"use strict";
// extension.ts
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
const WindowSettings_1 = __importDefault(require("../../src/WindowSettings/WindowSettings"));
const ResourceStateCoordinator_1 = __importDefault(require("../../src/ResourceStateCoordinator/ResourceStateCoordinator"));
const Panel_1 = __importDefault(require("../../src/TreeViewPanel/Panel"));
const FileDecorationProvider_1 = __importDefault(require("../../src/FileDecorationProvider/FileDecorationProvider"));
const common_1 = require("../../src/common");
const Runtime_1 = __importDefault(require("../../src/Runtime/Runtime"));
const BASE_CONFIG_SECTION = 'taskCockpit';
const logOutputChannel = vscode.window.createOutputChannel('taskCockpit-DEBUG', { log: true });
// assert.ok(logChannel.logLevel <= vscode.LogLevel.Debug);
logOutputChannel.show();
async function activate(context) {
    logOutputChannel.debug(`[ACTIVATED] ${context.extension.id}`);
    // --------------
    vscode.commands.registerCommand('task-cockpit.settings.configure-filtering', function () {
        return vscode.commands.executeCommand('workbench.action.openWorkspaceSettings', { query: '@ext:papio-dev.task-cockpit taskCockpit.filtering' });
    });
    vscode.commands.registerCommand('DEBUG.task-cockpit.TTT', function () {
        void vscode.window.showInformationMessage('task-cockpit.TTT');
    });
    vscode.commands.registerCommand('DEBUG.open-task-in-editor', async function () {
        // type Item = vscode.QuickPickItem & { taskSource: Immutable<TaskSource>; taskName: TaskName; };
        // const items: Item[] = [];
        // const collect = (scopeKey: OriginKey, scopeName: string) => {
        //     const taskSource = stateCoordinator.getTaskSource(scopeKey);
        //     if (taskSource === null) return;
        //     const definitions = stateCoordinator.getTaskDefinitionEntries(scopeKey);
        //     if (definitions === null) return;
        //     for (const [taskName] of definitions) {
        //         items.push({ label: `${scopeName} › ${taskName}`, taskSource, taskName });
        //     }
        // };
        // if (items.length === 0) {
        //     void vscode.window.showInformationMessage('No tasks found.');
        //     return;
        // }
        // const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select a task' });
        // if (picked === undefined) return;
        // // await openTaskDefinitionInEditor(picked.taskSource, picked.taskName);
    });
    vscode.commands.registerCommand('task-cockpit.force-full-refresh', function () {
        if (resourceStateCoordinator.disposed) {
            return;
        }
        void resourceStateCoordinator.forceFullRefresh();
    });
    vscode.commands.registerCommand('_debug.force-full-refresh', function () {
        if (resourceStateCoordinator.disposed) {
            return;
        }
        void resourceStateCoordinator.forceFullRefresh();
    });
    vscode.commands.registerCommand('_debug._', function () {
        return;
    });
    // -------------------
    vscode.commands.registerCommand('task-cockpit.view-container.global-task-view.expand-all', function () {
        panel.expandAllInView(common_1.GLOBAL_TREE_VIEW.ID);
    });
    vscode.commands.registerCommand('task-cockpit.view-container.workspace-task-view.expand-all', function () {
        panel.expandAllInView(common_1.PROJECT_TREE_VIEW.ID);
    });
    //
    const windowSettings = new WindowSettings_1.default(logOutputChannel);
    const resourceStateCoordinator = await ResourceStateCoordinator_1.default.create(10_000, logOutputChannel);
    const runtime = new Runtime_1.default({
        windowSettings,
        resourceStateCoordinator
    }, logOutputChannel);
    const dep = {
        windowSettings,
        resourceStateCoordinator,
        processRegistry: runtime.processRegistry
    };
    vscode.window.registerFileDecorationProvider(new FileDecorationProvider_1.default(dep, logOutputChannel));
    // setTimeout(() => {
    //     resourceStateCoordinator.dispose();
    // }, 15_000);
    const panel = new Panel_1.default(dep, logOutputChannel);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map