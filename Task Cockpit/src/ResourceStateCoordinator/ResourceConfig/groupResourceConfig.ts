import {
    workspace
} from 'vscode';
import Configuration from '../../Configuration';
import OriginKey from '../../OriginKey';

import type Immutable from '../../utils/Immutable';
import type ResourceStructure from '../ResourceStructure';


function groupResourceConfig<SchemaType extends object>(
    scopeLayout: Immutable<ResourceStructure>,
    resourceConfigSchema: Configuration.ConfigSchema<SchemaType>
): Map<OriginKey, SchemaType> {


    const outMap = new Map<OriginKey, SchemaType>();

    // global изолировано, остальное мержится (без изоляции)
    outMap.set(OriginKey.USER, Configuration.coerce(
        workspace.getConfiguration(),
        resourceConfigSchema,
        Configuration.IsolationMode.GlobalOnly
    ));

    if (scopeLayout.Workspace) {
        outMap.set(OriginKey.WORKSPACE, Configuration.coerce(
            workspace.getConfiguration(),
            resourceConfigSchema
        ));
    }

    if (scopeLayout.folders) {
        for (const folderScope of scopeLayout.folders) {
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
