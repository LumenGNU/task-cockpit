import {
    workspace
} from 'vscode';
import Scope from './Scope';
import isWorkspace from './isWorkspace';


function getDisplayName(scope: Scope): string {

    if (isWorkspace(scope)) {
        return workspace.name ?? '<untitled> (Workspace)';
    }

    return scope.name;
}


export default getDisplayName;
