import {
    workspace
} from 'vscode';
import {
    coerce
} from '../ConfigSchema';


import type {
    ConfigSchema
} from '../ConfigSchema';
import type WindowConfig from './Config';
import type Immutable from '../utils/Immutable';


function readWindowConfig(baseConfigSection: string, windowConfigSchema: Immutable<ConfigSchema<WindowConfig>>): Immutable<WindowConfig> {
    const workspaceConfig = workspace.getConfiguration(baseConfigSection, null);
    return coerce(
        workspaceConfig,
        windowConfigSchema
    );
}

export default readWindowConfig;
