import {
    workspace
} from 'vscode';
import isGlobal from './isGlobal';
import isWorkspace from './isWorkspace';

import type Immutable from '../utils/Immutable';
import type Scope from './Scope';


function getDisplayName(scope: Immutable<Scope>): string {

    if (isGlobal(scope)) {
        return 'User'; // @todo Global?
    }
    else if (isWorkspace(scope)) {
        return workspace.name ?? '<untitled> (Workspace)';
    }

    return scope.name;
}


export default getDisplayName;
