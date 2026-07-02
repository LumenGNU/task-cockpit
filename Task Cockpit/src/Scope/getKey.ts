
import type Key from './Key';
import type Scope from './Scope';
import isWorkspace from './isWorkspace';
import WorkspaceKey from './Workspace/Key';
import GlobalKey from './Global/Key';
import isGlobal from './isGlobal';

// Scope → Key (сериализация) */
function getKey(scope: Scope): Key {

    if (isGlobal(scope)) {
        return GlobalKey;
    }

    if (isWorkspace(scope)) {
        return WorkspaceKey;
    }

    return scope.uri.toString();
}


export default getKey;
