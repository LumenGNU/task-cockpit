import type Config from '../Configuration/Scoped/Config';
import type Reader from '../Configuration/Scoped/Reader';
import type Scope from './Scope';


function readConfig(scope: Scope, reader: Reader): Config {
    return reader.read(scope);
}


export default readConfig;
