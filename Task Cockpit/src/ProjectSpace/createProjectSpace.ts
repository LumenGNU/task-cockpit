import {
    type ConfigurationChangeEvent,
    type CancellationToken
} from 'vscode';
import { CONFIG_SECTION_NAME } from '../constants';
import getScopes from './getScopes';
import createReader from '../Configuration/Scoped/createReader';
import shouldRebuildSnapshot from './shouldRebuildSnapshot';
import buildSnapshot from './buildSnapshot';
import type Scope from '../Scope/Scope';
import type ProjectSpace from './ProjectSpace';


function createProjectSpace(): ProjectSpace {

    // Читатель конфигурации
    const reader = createReader(CONFIG_SECTION_NAME);

    return {
        getScopes,
        shouldRebuildSnapshot(event: ConfigurationChangeEvent) { return shouldRebuildSnapshot(event, CONFIG_SECTION_NAME); },
        async buildSnapshot(scopes: ReadonlyArray<Readonly<Scope>>, token: CancellationToken) { return await buildSnapshot(scopes, reader, token); }
    } as const;

}


export default createProjectSpace;
