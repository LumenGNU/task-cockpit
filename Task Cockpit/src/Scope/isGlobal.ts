import {
    TaskScope
} from 'vscode';
import type Scope from './Scope';
import type Global from './Global/Global';
import type Immutable from '../utils/Immutable';


function isGlobal(scope: Immutable<Scope>): scope is Immutable<Global> {
    return scope === TaskScope.Global;
}


export default isGlobal;
