import * as vscode from 'vscode';
import type Scope from '.';


type List = Scope[];

const List = {

    get(): List {

        const list = [] as List;

        // если есть — всегда первым
        if (vscode.workspace.workspaceFile) {
            list.push(vscode.TaskScope.Workspace);
        }

        if (vscode.workspace.workspaceFolders?.length) {
            list.push(...vscode.workspace.workspaceFolders);
        }

        return list;
    }

} as const;

export default List;
