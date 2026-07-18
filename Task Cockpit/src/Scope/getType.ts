import type Scope from './Scope';
import isWorkspace from './isWorkspace';
import type Type from './Type';
import isGlobal from './isGlobal';
import type Immutable from '../utils/Immutable';


function getType(scope: Immutable<Scope>): Type {
    return isWorkspace(scope)
        ? 'Workspace'
        : isGlobal(scope)
            ? 'Global'
            : 'Folder';
}


export default getType;
