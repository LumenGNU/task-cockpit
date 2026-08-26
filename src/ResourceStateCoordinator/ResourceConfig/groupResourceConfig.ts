/** @file ResourceStateCoordinator/ResourceConfig/groupResourceConfig.ts */
/** @internal */

import {
    workspace
} from 'vscode';
import Configuration from '../../Configuration';

import type OriginKey from '../../OriginKey';
import type Immutable from '../../utils/Immutable';
import type ResourceStructure from '../ResourceStructure';


function groupResourceConfig<SchemaType extends object>(
    resourceStructure: Immutable<ResourceStructure>,
    resourceConfigSchema: Configuration.ConfigSchema<SchemaType>
): Map<OriginKey, SchemaType> {


    const outMap = new Map<OriginKey, SchemaType>();

    // global изолировано, остальное мержится (без изоляции)
    outMap.set(resourceStructure.User.originKey, Configuration.coerce(
        workspace.getConfiguration(),
        resourceConfigSchema,
        Configuration.IsolationMode.UserOnly
    ));

    if (resourceStructure.Workspace) {
        outMap.set(resourceStructure.Workspace.originKey, Configuration.coerce(
            workspace.getConfiguration(),
            resourceConfigSchema
        ));
    }

    if (resourceStructure.folders) {
        for (const folderScope of resourceStructure.folders) {
            outMap.set(folderScope.originKey,
                Configuration.coerce(
                    workspace.getConfiguration('', folderScope.uri),
                    resourceConfigSchema
                )
            );
        }
    }

    return outMap;

}

export default groupResourceConfig;
