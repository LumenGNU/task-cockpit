
import GLOBAL_KEY from './Global/Key';
import isGlobal from './isGlobal';
import isWorkspace from './isWorkspace';
import WORKSPACE_KEY from './Workspace/Key';

import type Immutable from '../utils/Immutable';
import type ScopeKey from './Key';
import type Scope from './Scope';

// Scope → Key (сериализация) */
function getKey(scope: Immutable<Scope>): ScopeKey {

    if (isGlobal(scope)) {
        return GLOBAL_KEY;
    }

    if (isWorkspace(scope)) {
        return WORKSPACE_KEY;
    }

    return scope.uri.toString();
}


export default getKey;
