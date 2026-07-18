import type Folder from './Folder/Folder';
import type Scope from './Scope';
import type Immutable from '../utils/Immutable';


function isFolder(scope: Immutable<Scope>): scope is Immutable<Folder> {
    return typeof scope !== 'number';
}


export default isFolder;
