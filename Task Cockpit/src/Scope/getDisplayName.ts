import {
    workspace
} from 'vscode';
import Scope from './Scope';
import isWorkspace from './isWorkspace';
import isGlobal from './isGlobal';


function getDisplayName(scope: Scope): string {

    if (isGlobal(scope)) {
        return 'User'; // @todo Global?
    }
    else if (isWorkspace(scope)) {
        return workspace.name ?? '<untitled> (Workspace)';
    }

    return scope.name;
}


export default getDisplayName;
