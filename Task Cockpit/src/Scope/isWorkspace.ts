import {
    TaskScope
} from 'vscode';
import type Scope from './Scope';
import type Workspace from './Workspace/Workspace';


function isWorkspace(scope: Scope): scope is Workspace {
    return scope === TaskScope.Workspace;
}


export default isWorkspace;
