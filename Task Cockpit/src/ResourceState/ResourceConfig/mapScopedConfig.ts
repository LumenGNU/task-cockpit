import {
    workspace
} from 'vscode';
import {
    coerce
} from '../../ConfigSchema';

import type {
    ConfigSchema
} from '../../ConfigSchema';
import type ResourceConfig from './Config';
import type { State } from '../State';
import ScopeKey from '../../ScopeKey';
// import type Immutable from '../../utils/Immutable';


function mapScopedConfig(
    scopeLayout: State.ScopeLayout,
    baseConfigSection: string,
    resourceConfigSchema: ConfigSchema<ResourceConfig>
): Map<ScopeKey, ResourceConfig> {


    const outMap = new Map<ScopeKey, ResourceConfig>();

    outMap.set(ScopeKey.GLOBAL_KEY, coerce(getIsolatedGlobalConfig(baseConfigSection), resourceConfigSchema));

    if (scopeLayout[ScopeKey.WORKSPACE_KEY]) {
        outMap.set(ScopeKey.WORKSPACE_KEY, coerce(getIsolatedWorkspaceTasks(baseConfigSection), resourceConfigSchema));
    }

    if (scopeLayout.folders) {
        for (const [folderKey, folderScope] of Object.entries(scopeLayout.folders)) {
            outMap.set(folderKey as ScopeKey.FolderKey, coerce(getIsolatedFolderTasks(baseConfigSection, folderScope), resourceConfigSchema));
        }
    }

    return outMap;

}


function getIsolatedGlobalConfig(baseConfigSection: string): { [k: string]: unknown; } | undefined {
    return workspace.getConfiguration().inspect<{ [k: string]: unknown; }>(baseConfigSection)?.globalValue;
}


function getIsolatedWorkspaceTasks(baseConfigSection: string): { [k: string]: unknown; } | undefined {
    return workspace.getConfiguration(baseConfigSection, null);
}


function getIsolatedFolderTasks(baseConfigSection: string, scope: State.FolderScope): { [k: string]: unknown; } | undefined {
    return workspace.getConfiguration(baseConfigSection, scope);
}


export default mapScopedConfig;
