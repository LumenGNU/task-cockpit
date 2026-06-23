import SCHEMA from './SCHEMA';
import type Config from './Config';
import type Reader from './Reader';
import isWorkspace from '../../Scope/isWorkspace';
import {
    createSchema,
    read
} from '../Configuration';


function createReader(
    baseSection: string
): Reader {

    const schema = createSchema<Config>(SCHEMA);

    return {
        read(scope) {
            return read({
                schema,
                baseSection,
                configurationScope: isWorkspace(scope) ? null : scope
            });
        }
    } as const;
}


export default createReader;
