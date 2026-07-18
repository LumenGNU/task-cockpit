import {
    TaskScope
} from 'vscode';
import type Scope from './Scope';
import type Workspace from './Workspace/Workspace';
import type Immutable from '../utils/Immutable';


function isWorkspace(scope: Immutable<Scope>): scope is Immutable<Workspace> {
    return scope === TaskScope.Workspace;
}


export default isWorkspace;
