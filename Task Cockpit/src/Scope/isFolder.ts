import type Folder from './Folder/Folder.d';
import type Scope from './Scope.d';


function isFolder(scope: Scope): scope is Folder {
    return typeof scope !== 'number';
}


export default isFolder;
