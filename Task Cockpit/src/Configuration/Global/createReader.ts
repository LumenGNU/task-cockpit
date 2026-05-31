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

    const configuration = Configuration.get(
        schema,
        workspace.getConfiguration(section, undefined)
    );

    // дополнительная валидация polling.cap >= polling.min * 1.7
    configuration.cockpit.monitor.polling.cap =
        Math.max(
            configuration.cockpit.monitor.polling.min * 1.7,
            configuration.cockpit.monitor.polling.cap
        );

    return configuration;
}


export default createReader;
