import {
    TaskScope
} from 'vscode';
import type Scope from './Scope';
import type Global from './Global/Global';


function isGlobal(scope: Scope): scope is Global {
    return scope === TaskScope.Global;
}


export default isGlobal;
