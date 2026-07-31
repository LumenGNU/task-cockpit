import {
    workspace
} from 'vscode';
import ScopeKey from '../../ScopeKey';
import Configuration from '../../Configuration';
import type Immutable from '../../utils/Immutable';
import type Scope from '../Scope';


function mapScopedConfig<SchemaType extends object>(
    scopeLayout: Immutable<Scope.ScopeLayout>,
    resourceConfigSchema: Configuration.ConfigSchema<SchemaType>
): Map<ScopeKey, SchemaType> {


    const outMap = new Map<ScopeKey, SchemaType>();

    // global изолировано, остальное мержится (без изоляции)
    outMap.set(ScopeKey.GLOBAL_KEY, Configuration.coerce(
        workspace.getConfiguration(),
        resourceConfigSchema,
        Configuration.IsolationMode.GlobalOnly
    ));

    if (scopeLayout[ScopeKey.WORKSPACE_KEY]) {
        outMap.set(ScopeKey.WORKSPACE_KEY, Configuration.coerce(
            workspace.getConfiguration(),
            resourceConfigSchema
        ));
    }

    if (scopeLayout.folders) {
        for (const [folderKey, folderScope] of Object.entries(scopeLayout.folders)) {
            outMap.set(folderKey as ScopeKey.FolderKey, Configuration.coerce(
                workspace.getConfiguration('', folderScope),
                resourceConfigSchema
            ));
        }
    }

    return outMap;

}

export default mapScopedConfig;
