import {
    workspace
} from 'vscode';
import { Configuration } from '../Configuration';
import Config from './Config';
import Reader from './Reader';
import SCHEMA from './SCHEMA';


function createReader(section: string): Reader {

    const schema = Configuration.createSchema<Config>(SCHEMA);

    return {
        read() {
            return read(section, schema);
        }
    } as const;
}


function read(
    section: string,
    schema: Readonly<Configuration.ConfigSchema<Config>>
) {

    return Configuration.get(
        schema,
        workspace.getConfiguration(section, undefined)
    );

}


export default createReader;
