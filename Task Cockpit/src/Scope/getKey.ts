
import type Key from './Key';
import type Scope from './Scope';
import isWorkspace from './isWorkspace';
import WorkspaceKey from './Workspace/Key';

// Scope → Key (сериализация) */
function getKey(scope: Scope): Key {

    if (isWorkspace(scope)) {
        return WorkspaceKey;
    }

    return scope.uri.toString();
}


export default getKey;
