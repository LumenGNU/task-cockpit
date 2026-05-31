import {
    workspace
} from 'vscode';
import {
    Configuration
} from '../Configuration';
import SCHEMA from './SCHEMA';
import type Config from './Config';
import type Reader from './Reader';
import type Scope from '../../Scope/Scope';
import isWorkspace from '../../Scope/isWorkspace';


function createReader(section: string): Reader {

    const schema = Configuration.createSchema<Config>(SCHEMA);

    return {
        read(scope) {
            return read(section, schema, scope);
        }
    } as const;
}


function read(
    section: string,
    schema: Readonly<Configuration.ConfigSchema<Config>>,
    scope: Scope
) {

    return Configuration.get(
        schema,
        workspace.getConfiguration(section, isWorkspace(scope) ? undefined : scope)
    );
}


export default createReader;
