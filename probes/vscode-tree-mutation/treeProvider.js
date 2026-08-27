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
exports.FreezeTreeProvider = void 0;
exports.asTreeDataProvider = asTreeDataProvider;
const vscode = __importStar(require("vscode"));
function asTreeDataProvider(p) {
    return p;
}
// ── Фабрика узлов ─────────────────────────────────────────────────────────────
//
// Замораживаем и массив children, и сам узел — Object.freeze shallow,
// поэтому оба уровня нужны явно.
function node(id, label, ...children) {
    return Object.freeze({
        id,
        label,
        children: Object.freeze(children),
    });
}
// ── Дерево ────────────────────────────────────────────────────────────────────
const ROOT = Object.freeze([
    node('alpha', 'Alpha', node('alpha-1', 'Alpha 1'), node('alpha-2', 'Alpha 2')),
    node('beta', 'Beta', node('beta-1', 'Beta 1', node('beta-1-1', 'Beta 1.1'))),
    node('gamma', 'Gamma'),
]);
// ── Провайдер ─────────────────────────────────────────────────────────────────
class FreezeTreeProvider {
    getTreeItem(element) {
        // Убеждаемся что VS Code вернул именно наш замороженный объект,
        // а не копию / обёртку
        if (!Object.isFrozen(element)) {
            throw new Error(`[freeze-tree] element '${element.id}' NOT frozen`);
        }
        if (!Object.isFrozen(element.children)) {
            throw new Error(`[freeze-tree] children of '${element.id}' NOT frozen`);
        }
        return new vscode.TreeItem(element.label, element.children.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None);
    }
    getChildren(element) {
        const result = element === undefined ? ROOT : element.children;
        if (!Object.isFrozen(result)) {
            throw new Error(`[freeze-tree] result array NOT frozen`);
        }
        return result;
    }
}
exports.FreezeTreeProvider = FreezeTreeProvider;
//# sourceMappingURL=treeProvider.js.map