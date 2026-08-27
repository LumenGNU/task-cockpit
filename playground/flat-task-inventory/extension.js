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
const WindowSettings_1 = __importDefault(require("../../src/WindowSettings/WindowSettings"));
const Runtime_1 = __importDefault(require("../../src/Runtime/Runtime"));
const TaskName_1 = __importDefault(require("../../src/TaskName"));
const ResourceStateCoordinator_1 = __importDefault(require("../../src/ResourceStateCoordinator/ResourceStateCoordinator"));
const DiagnosticsManager_1 = __importDefault(require("../../src/TasksSource/Diagnostics/DiagnosticsManager"));
async function activate(context) {
    const ext = context.extension;
    const extName = ext.packageJSON['displayName'];
    const logChannel = vscode.window.createOutputChannel(extName);
    const traceChannel = vscode.window.createOutputChannel(`${extName} - trace`, { log: true });
    context.subscriptions.push(logChannel, traceChannel);
    void vscode.window.showInformationMessage(`"${extName}" activated`);
    logChannel.show();
    await run(context.subscriptions, logChannel, traceChannel);
}
function deactivate() { }
// ----------------------------------------------
async function run(subscriptions, logChannel, traceChannel) {
    const resourceStateCoordinator = await ResourceStateCoordinator_1.default.create(5_000, traceChannel);
    const windowSettings = new WindowSettings_1.default(traceChannel);
    const runtime = new Runtime_1.default({
        resourceStateCoordinator,
        windowSettings
    }, traceChannel);
    const diagnosticsManager = new DiagnosticsManager_1.default('Task Cockpit', {
        resourceStateCoordinator,
        windowSettings
    }, traceChannel);
    const render = async () => {
        const originEntries = await resourceStateCoordinator.getOriginEntries();
        const parts = [];
        parts.push(await formatOriginEntry(originEntries.User, runtime.processRegistry, resourceStateCoordinator));
        if (originEntries.Workspace) {
            parts.push(await formatOriginEntry(originEntries.Workspace, runtime.processRegistry, resourceStateCoordinator));
        }
        for (const originEntry of originEntries.folders) {
            parts.push(await formatOriginEntry(originEntry, runtime.processRegistry, resourceStateCoordinator));
        }
        logChannel.replace(parts.join('\n'));
    };
    await render();
    subscriptions.push(resourceStateCoordinator, resourceStateCoordinator.onDidStateChange(() => { void render(); }), runtime, runtime.processRegistry.onDidChangeTaskProcesses(() => { void render(); }), diagnosticsManager);
}
async function formatOriginEntry(originEntry, processRegistry, resourceStateCoordinator) {
    const segmentSeparator = originEntry.hierarchyConfig.segmentSeparator;
    const definitionEntries = [...originEntry.definitionEntries];
    const taskLines = definitionEntries.length === 0
        ? ['    (empty)']
        : await Promise.all(definitionEntries.map(([taskName]) => formatTaskLabel(originEntry.originKey, taskName, TaskName_1.default.formatTaskName(taskName, { segmentSeparator, displaySeparator: '·' }), resourceStateCoordinator, processRegistry)));
    const out = [
        originEntry.name,
        '-'.repeat(originEntry.name.length),
        ...taskLines
    ];
    return out.join('\n') + '\n';
}
async function formatTaskLabel(originKey, taskName, displayName, resourceStateCoordinator, processRegistry) {
    const { taskDefinition, eligibleTask } = await resourceStateCoordinator.getTaskBundle(originKey, taskName);
    const processStates = processRegistry.getTaskProcessStates(originKey, taskName);
    const marker = (() => {
        if (taskDefinition == null)
            return '⦸';
        if (eligibleTask == null)
            return '⚠';
        if (processStates != null) {
            return [...processStates.values()].some((s) => s.running) ? '⦿' : '⦾';
        }
        return '▪';
    })();
    return `    ${marker} ${displayName}`;
}
//# sourceMappingURL=extension.js.map