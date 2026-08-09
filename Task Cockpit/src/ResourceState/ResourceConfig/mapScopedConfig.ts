import {
    workspace
} from 'vscode';
import ScopeKey from '../../ScopeKey';
import Configuration from '../../Configuration';
import type Immutable from '../../utils/Immutable';
import type ScopeLayout from '../ScopeLayout';


function mapScopedConfig<SchemaType extends object>(
    scopeLayout: Immutable<ScopeLayout>,
    resourceConfigSchema: Configuration.ConfigSchema<SchemaType>
): Map<ScopeKey, SchemaType> {


    const outMap = new Map<ScopeKey, SchemaType>();

    // global изолировано, остальное мержится (без изоляции)
    outMap.set(ScopeKey.GLOBAL_KEY, Configuration.coerce(
        workspace.getConfiguration(),
        resourceConfigSchema,
        Configuration.IsolationMode.GlobalOnly
    ));

    if (scopeLayout.isMultiRoot) {
        outMap.set(ScopeKey.WORKSPACE_KEY, Configuration.coerce(
            workspace.getConfiguration(),
            resourceConfigSchema
        ));
    }

    if (scopeLayout.folderScopes) {
        for (const folderScope of scopeLayout.folderScopes) {
            outMap.set(folderScope.key,
                Configuration.coerce(
                    workspace.getConfiguration('', folderScope.uri),
                    resourceConfigSchema
                )
            );
        }
    }

    return outMap;

}

export default mapScopedConfig;
