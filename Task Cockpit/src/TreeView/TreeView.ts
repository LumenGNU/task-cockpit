import * as vscode from 'vscode';
import TreeDataProvider from './TreeDataProvider';
import Hierarchy from '../TreeModel/Hierarchy';
import NodeSpec from '../TreeModel/NodeSpec';
import Scope from '../ProjectSpace/Scope/Scope';
import type { ConfigurationReader, ScopedSettings } from '../Configuration/Scoped';
import type { Definition } from '../ProjectSpace/Scope/Scope.Definitions.fetchDefinitions';
import type { FolderKey } from '../type.d/FolderKey';
import { WorkspaceKey } from '../constants';
import type ScopeSection from './Section/ScopeSection';
import NodeType from './NodeType';


class TreeView {

    #treeDataProvider: TreeDataProvider;
    #treeView;


    constructor() {

        this.#treeDataProvider = new TreeDataProvider();

        this.#treeView = vscode.window.createTreeView(
            'task-cockpit-view', {
            treeDataProvider: this.#treeDataProvider,
            canSelectMany: false
        });

    }



    public get sections() {


    }

}
