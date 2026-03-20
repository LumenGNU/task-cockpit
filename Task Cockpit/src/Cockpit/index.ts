/** @file Cockpit/index.ts */
/** @module Cockpit */

import * as vscode from 'vscode';
import helpers from '../helpers';
import MainDataProvider from './MainDataProvider';
import Tree from './Tree';
import type * as TC from '../types';

import Runtime from '../Runtime';
import Workspace from '../Workspace';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


class Cockpit implements vscode.Disposable {


    private readonly mainDataProvider: MainDataProvider;
    private readonly mainTreeView: vscode.TreeView<Tree.Node.NodeType>;


    private readonly disposable: vscode.Disposable;


    private constructor(
        private readonly runtime: Runtime,
        private readonly workspace: Workspace,
        private roots: ReadonlyArray<Tree.Node.RootNodeFolder | Tree.Node.RootNodeWorkspace>,
        dirty: boolean
    ) {

        this.mainDataProvider = new MainDataProvider({
            getRuntime_cb: (taskId) => this.runtime.state(taskId),
            getResourceSettings_cb: (file) => this.workspace.getResourceSettings().get(file)!,
            getTaskDetail_cb: (taskId) => this.workspace.getTask(taskId)?.detail,
        });

        const listeners = vscode.Disposable.from(
            runtime.onDidChange((taskId: TC.TaskID) => {
                this.mainDataProvider.refreshRunnableNode(taskId);
            }),

            workspace.onDidChange(() => {
                this.rebuild();
            }),
        );

        this.mainTreeView = vscode.window.createTreeView('task-cockpit-view', {
            treeDataProvider: this.mainDataProvider,
            canSelectMany: false
        });


        if (!dirty) {
            this.rebuildViews();
        }

        this.disposable = vscode.Disposable.from(
            listeners,
            this.mainTreeView,
            this.mainDataProvider,
        );

    }


    public dispose() {

        this.disposable.dispose();
        this.roots = undefined as never;

        // #region DEBUG
        log(LogLevel.Debug, 'Disposed', 'dispose');
        // #endregion DEBUG
    }


    static async create(runtime: Runtime, workspace: Workspace): Promise<Cockpit> {

        let dirty = false;
        const listener = workspace.onDidChange(() => { dirty = true; });

        await workspace.reScan();

        listener.dispose();

        const cockpit = new Cockpit(
            runtime,
            workspace,
            Tree.sproutRoots(
                workspace.getScopes(),
                workspace.getDefinitions(),
                workspace.getResourceSettings(),
                workspace.getWindowSettings()
            ),
            dirty
        );

        if (dirty) {
            await cockpit.rebuild();
        }

        return cockpit;
    }


    // #region DEBUG
    public getTreeItem(node: Tree.Node.NodeType) {
        return this.mainDataProvider.getTreeItem(node);
    }
    // #endregion DEBUG


    public resolveTaskId(node?: Tree.Node.NodeType): TC.TaskID | undefined {

        if (!node) {

            // #region DEBUG
            log(LogLevel.Debug, 'No node provided', 'resolveTaskId');
            // #endregion DEBUG

            return undefined;
        }

        if (!Tree.Node.isRunnable(node)) {

            // #region DEBUG
            log(LogLevel.Debug, 'Node is not runnable', 'resolveTaskId');
            // #endregion DEBUG

            return undefined;
        }

        // #region DEBUG
        log(LogLevel.Debug, `Resolved task ID: ${helpers.printTaskId(node.id)}`, 'resolveTaskId');
        // #endregion DEBUG


        return node.id;

    }


    public resolveTaskFile(node?: Tree.Node.NodeType): TC.File | undefined {

        if (!node) {
            return undefined;
        }

        if ('nodePath' in node) {
            return Tree.Node.parseNodePath(node).taskFile;
        }

        if ('tasksFile' in node) {
            return node.tasksFile;
        }

        return undefined;
    }


    public async rebuild() {

        // #region DEBUG
        log(LogLevel.Debug, 'Rebuild started ...', 'rebuild');
        // #endregion DEBUG

        try {
            await this.workspace.reScan();

            this.roots = Tree.sproutRoots(
                this.workspace.getScopes(),
                this.workspace.getDefinitions(),
                this.workspace.getResourceSettings(),
                this.workspace.getWindowSettings()
            );

            this.rebuildViews();

            // #region DEBUG
            log(LogLevel.Debug, 'Rebuild finished', 'rebuild');
            // #endregion DEBUG
        }
        // #region DEBUG
        catch (error) {
            if (!(error instanceof vscode.CancellationError)) {
                log(LogLevel.Error, `Internal error: Failed to re-scan workspace: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
                vscode.window.showErrorMessage(`Internal error: Failed to re-scan workspace: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
            }
            log(LogLevel.Debug, 'Cancelled', 'rebuild');
        }
        // #endregion DEBUG
        finally { }
    }


    public printNodePath(node: Tree.Node.NodeType) {
        if (Tree.Node.isRunnable(node)) {
            return Tree.Node.parseNodePath(node).segments.join(' • ');
        }
    }


    private rebuildViews() {

        // Сброс сообщения вюверов. Если временно станут пусты — будет отображаться
        // базовое "Loading..." из "viewsWelcome"

        // this.mainTreeView.title = '';
        this.mainTreeView.message = undefined;
        this.mainTreeView.description = undefined;

        // @todo может быть, если выполняется больше одной задачи? @reject: фигня. и не красиво
        // this.mainTreeView.badge = { value: NaN, tooltip: 'xxx' };


        // #region DEBUG
        log(LogLevel.Trace, 'Rebuilding providers ...', 'rebuild');
        // #endregion DEBUG

        const { total, displayed } = this.mainDataProvider.rebuild(this.roots);

        // Сообщение если вювер после обновления стал визуально пустой —
        // "нет папок для отображения"
        if (displayed < total) {
            // В single-root workspace всегда отображается как минимум папка-имя проекта (возможно без задач).
            // А ситуацию "нет задач для отображения" обрабатывает дерево.
            if (displayed < 1) {
                this.mainTreeView.message = 'All tasks are filtered out. Check Task Cockpit filtering settings.';
            }

            this.mainTreeView.description = `( ${displayed} of ${total} folders )`;

        }

        // #region DEBUG
        log(LogLevel.Trace, 'Rebuilding providers finished', 'rebuild');
        // #endregion DEBUG
    }
}


namespace Cockpit {
    export type Node = Tree.Node.NodeType;
}

export default Cockpit;
