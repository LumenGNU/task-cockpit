import * as vscode from 'vscode';
import Configuration from './Configuration';
import { OptionType } from './Configuration';
import type { ScopedSettings } from '../type.d/ScopedSettings';
import type Scope from '../Scope';


const SCHEMA = {
    treeConfig: {
        segmentSeparator: {
            from: 'display',
            type: OptionType.String,
            spec: { fallback: '', pattern: /^.*$/ }
        },
        useGroupKind: {
            from: 'display',
            type: OptionType.Boolean,
            spec: { fallback: false }
        },
        showHidden: {
            from: 'filtering',
            type: OptionType.Boolean,
            spec: { fallback: false }
        }
    },
    nodeConfig: {
        defaultIconName: {
            from: 'display',
            type: OptionType.String,
            spec: { fallback: 'tools', pattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/ }
        },
        tintLabel: {
            from: 'display',
            type: OptionType.Boolean,
            spec: { fallback: false }
        },
        useFolderIcon: {
            from: 'display',
            type: OptionType.Boolean,
            spec: { fallback: false }
        },
    }
} satisfies Readonly<Configuration.ConfigSchema<ScopedSettings>>;


function init(section: string) {

    const schema = Configuration.createSchema<ScopedSettings>(SCHEMA);

    return {
        read(scope: Scope) {
            return read(section, schema, scope);
        }
    } as const;
}


function read(section: string, schema: Readonly<Configuration.ConfigSchema<ScopedSettings>>, scope: Scope) {

    const configuration = Configuration.get(
        schema,
        vscode.workspace.getConfiguration(section, scope === vscode.TaskScope.Workspace ? undefined : scope)
    );

    return configuration;

}

const ScopedConfiguration = {
    init
};

export default ScopedConfiguration;

export type { ScopedSettings };
