/** @file Workspace/ScopedConfig/index.ts */
/** @module ScopedConfig */

import * as vscode from 'vscode';
import Configuration from '../../Configuration/Configuration';
import { OptionType } from '../../Configuration/Configuration';
import type Scope from '../Scope';
import type HierarchyConfig from './HierarchyConfig';
import type NodeConfig from './NodeConfig';


const SCHEMA = {
    hierarchyConfig: {
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
} satisfies Readonly<Configuration.ConfigSchema<ScopedConfig>>;



function init(section: string): ScopedConfig.Reader {

    const schema = Configuration.createSchema<ScopedConfig>(SCHEMA);

    return {
        read(scope: Scope) {
            return read(section, schema, scope);
        }
    } as const;
}


function read(section: string, schema: Readonly<Configuration.ConfigSchema<ScopedConfig>>, scope: Scope) {

    const configuration = Configuration.get(
        schema,
        vscode.workspace.getConfiguration(section, scope === vscode.TaskScope.Workspace ? undefined : scope)
    );

    return configuration;

}


interface ScopedConfig {
    hierarchyConfig: HierarchyConfig,
    nodeConfig: NodeConfig;
}


declare namespace ScopedConfig {

    export type Reader = { readonly read: (scope: Scope) => ScopedConfig; };

}


const ScopedConfig = {
    init
};


export default ScopedConfig;
