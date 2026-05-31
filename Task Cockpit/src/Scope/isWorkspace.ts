import {
    TaskScope
} from 'vscode';
import type Scope from './Scope.d';
import type Workspace from './Workspace/Workspace.d';


function isWorkspace(scope: Scope): scope is Workspace {
    return scope === TaskScope.Workspace;
}


export default isWorkspace;
