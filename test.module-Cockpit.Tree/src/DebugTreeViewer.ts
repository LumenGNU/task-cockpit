/** @file DebugTreeViewer.ts */

import * as vscode from 'vscode';
import Entity from './Cockpit/TreeModel/Entity';
import Hierarchy from './Cockpit/TreeModel/Hierarchy';
import helpers from './helpers';


/** Элемент дерева: корневой Entity или дочерний узел. */
type Element =
    | { readonly entity: Entity.FavoriteSection | Entity.FileSection }
    | { readonly child: Entity.Item };


/**
 * Простейший TreeDataProvider для отладочного просмотра структуры Entity.
 * Показывает все узлы развёрнутыми, без учёта `hidden` и прочих фильтров.
 */
export default class DebugTreeViewer implements vscode.TreeDataProvider<Element> {

    private entities: readonly (Entity.FavoriteSection | Entity.FileSection)[] = [];

    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;


    setData(entities: readonly (Entity.FavoriteSection | Entity.FileSection)[]): void {
        this.entities = entities;
        this._onDidChangeTreeData.fire();
    }


    getTreeItem(element: Element): vscode.TreeItem {

        if ('entity' in element) {
            const { kind, name } = element.entity;
            return new vscode.TreeItem(
                `[${kind}] ${name}`,
                vscode.TreeItemCollapsibleState.Expanded
            );
        }

        const { child } = element;
        const segment = Hierarchy.Node.getSegment(child);
        const isBranch = Hierarchy.Node.isBranch(child);

        const item = new vscode.TreeItem(
            segment,
            isBranch
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.None
        );


        if (Hierarchy.Node.isData(child)) {
            item.tooltip = helpers.printTaskId(child.id);
        }

        return item;
    }


    getChildren(element?: Element): Element[] {

        if (!element) {
            return this.entities.map(entity => ({ entity }));
        }

        if ('entity' in element) {
            return [...element.entity.children].map(child => ({ child }));
        }

        if (Hierarchy.Node.isBranch(element.child)) {
            return Hierarchy.Node.getBranchChildren(element.child)
                .map(child => ({ child }));
        }

        return [];
    }
}