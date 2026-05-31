import type Scope from '../../Scope/Scope';
import type Config from './Config';


interface Reader {
    readonly read: (scope: Scope) => Config;
}


export default Reader;
