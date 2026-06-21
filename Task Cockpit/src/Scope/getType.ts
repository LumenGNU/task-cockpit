import type Scope from './Scope';
import isWorkspace from './isWorkspace';
import type Type from './Type';


function getType(scope: Scope): Type {
    return isWorkspace(scope) ? 'Workspace' : 'Folder';
}


export default getType;
