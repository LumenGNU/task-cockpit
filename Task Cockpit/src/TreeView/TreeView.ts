import {
    window,
    TreeView as VscTreeView,
    Disposable,
    workspace
} from 'vscode';
import TreeDataProvider from '../TreeDataProvider/TreeDataProvider';
import RuntimeRegistry from '../Runtime/RuntimeRegistry';
import Runtime from '../Runtime/Runtime';

import {
    CONFIG_BASE_SECTION
} from '../constants';
import Element from '../TreeDataProvider/Element';
import FileDecorationProvider from '../DecorationProvider/FileDecorationProvider';
import GlobalConfig from '../Configuration/Global/GlobalConfig';
import createProjectSpace from '../ProjectSpace/createProjectSpace';


class TreeView {

    readonly #runtime: Runtime;
    readonly #globalConfig: GlobalConfig;

    readonly #treeView: VscTreeView<Readonly<Element>>;

    readonly #fileDecorationProvider: FileDecorationProvider;

    readonly #disposable: Array<Disposable>;

    #projectSpace;

    constructor() {

        this.#disposable = [];

        this.#globalConfig = new GlobalConfig(CONFIG_BASE_SECTION);

        this.#fileDecorationProvider = new FileDecorationProvider(this.#globalConfig);

        this.#disposable.push(
            window.registerFileDecorationProvider(this.#fileDecorationProvider)
        );

        this.#runtime = new Runtime(this.#globalConfig);

        this.#treeView = window.createTreeView('task-cockpit-view', {
            treeDataProvider: new TreeDataProvider(this.#runtime.registry),
            canSelectMany: false,
            dragAndDropController: undefined,
            manageCheckboxStateManually: undefined,
            showCollapseAll: true // @todo
        });


        workspace.onDidChangeConfiguration((e) => {

            this.#projectSpace.buildSnapshot(
                this.#globalConfig.read('ProjectSpaceConf'),
                new Map() // @fixme
            );

        });

        workspace.onDidChangeWorkspaceFolders((e) => {

        });

        this.#projectSpace = createProjectSpace(CONFIG_BASE_SECTION);
    }


    collapseAll() { }

    expandAll() { }


    pin() { }

    unpin() { }


    update() { }

}
