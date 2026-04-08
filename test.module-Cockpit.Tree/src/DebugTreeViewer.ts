/** @file DebugTreeViewer.ts */

import * as vscode from 'vscode';
import TreeModel from './Cockpit/TreeModel';
import type * as TC from './types';


/**
 * Простейший TreeDataProvider для отладочного просмотра структуры Entity.
 * Показывает все узлы развёрнутыми, без учёта `hidden` и прочих фильтров. */
export default class DebugTreeViewer implements vscode.TreeDataProvider<TreeModel.Node> {



    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private topRoots?: Array<TreeModel.TopRoot>;



    setData(topRoots: Array<TreeModel.TopRoot>): void {

        this.topRoots = topRoots;
        this._onDidChangeTreeData.fire();
    }


    getTreeItem(element: TreeModel.Node): vscode.TreeItem {
        return TreeModel.describe(element);
    }

    // resolveTreeItem(item: vscode.TreeItem, element: TreeModel.Node, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
    //     return item;
    // }



    getChildren(element?: TreeModel.Node): TreeModel.Node[] | undefined {

        if (!element) {
            return this.topRoots;
        }

        return TreeModel.getChildren(element);

    }
}