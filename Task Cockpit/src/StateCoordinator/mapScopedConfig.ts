import {
    workspace
} from 'vscode';
import {
    coerce
} from './ConfigSchema/ConfigSchema';
import getScopeKey from '../Scope/getKey';
import isFolder from '../Scope/isFolder';
import isWorkspace from '../Scope/isWorkspace';

import type Immutable from '../utils/Immutable';
import type ResourceConfig from './ConfigSchema/Resource/Config';
import type Scope from '../Scope/Scope';
import type ScopeKey from '../Scope/Key';
import type {
    ConfigSchema
} from './ConfigSchema/ConfigSchema';

function mapScopedConfig(scopes: Immutable<Array<Scope>>, baseConfigSection: string, resourceConfigSchema: Immutable<ConfigSchema<ResourceConfig>>): Immutable<Map<ScopeKey, ResourceConfig>> {
    return new Map(scopes.map((scope) => {

        const workspaceConfig =
            isFolder(scope)
                ? workspace.getConfiguration(baseConfigSection, scope)
                : isWorkspace(scope)
                    ? workspace.getConfiguration(baseConfigSection, null)
                    : workspace.getConfiguration().inspect<{ [k: string]: unknown; }>(baseConfigSection)?.globalValue;

        return [getScopeKey(scope), coerce(
            workspaceConfig,
            resourceConfigSchema
        )];
    }));
}

export default mapScopedConfig;
