"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProbeTreeProvider = void 0;
const vscode_1 = __importDefault(require("vscode"));
function buildUri(nodeIndex, state) {
    const params = new URLSearchParams();
    params.set('available', String(state.available));
    params.set('running', String(state.running));
    if (state.tintColor) {
        params.set('tintColor', state.tintColor);
    }
    return vscode_1.default.Uri.from({
        scheme: 'task-cockpit',
        authority: 'Node',
        path: `/node-${nodeIndex}`, // path игнорируется провайдером, нужен для уникальности Uri
        query: params.toString(),
    });
}
// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------
class ProbeNode extends vscode_1.default.TreeItem {
    constructor(index, state) {
        super(state.label, vscode_1.default.TreeItemCollapsibleState.None);
        this.id = `probe-node-${index}`;
        this.resourceUri = buildUri(index, state);
        this.tooltip = this.resourceUri.toString();
    }
}
class ProbeTreeProvider {
    _emitter = new vscode_1.default.EventEmitter();
    onDidChangeTreeData = this._emitter.event;
    _items = [];
    update(step) {
        this._items = step.nodes.map((node, i) => new ProbeNode(i, node));
        this._emitter.fire();
    }
    getTreeItem(element) { return element; }
    getChildren(element) { return element ? [] : this._items; }
    dispose() { this._emitter.dispose(); }
}
exports.ProbeTreeProvider = ProbeTreeProvider;
//# sourceMappingURL=Tree.js.map