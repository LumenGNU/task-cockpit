import {
    workspace
} from 'vscode';
import {
    coerce
} from './ConfigSchema/ConfigSchema';


import type {
    ConfigSchema
} from './ConfigSchema/ConfigSchema';
import type Immutable from '../utils/Immutable';
import type WindowConfig from './ConfigSchema/Window/Config';


function readWindowConfig(baseConfigSection: string, windowConfigSchema: Immutable<ConfigSchema<WindowConfig>>): Immutable<WindowConfig> {
    const workspaceConfig = workspace.getConfiguration(baseConfigSection, null);
    return coerce(
        workspaceConfig,
        windowConfigSchema
    );
}

export default readWindowConfig;
