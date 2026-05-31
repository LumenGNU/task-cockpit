import type Folder from './Folder/Folder.d';
import type Scope from './Scope.d';
import isWorkspace from './isWorkspace';


function isFolder(scope: Scope): scope is Folder {
    return !isWorkspace(scope);
}


export default isFolder;
