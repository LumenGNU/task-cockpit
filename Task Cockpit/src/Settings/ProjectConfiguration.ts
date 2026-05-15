import * as vscode from 'vscode';
import Configuration from './Configuration';
import { OptionType } from './Configuration';
import type { ProjectSettings } from '../type.d/ProjectSettings';


const SCHEMA = {

    filtering: {
        excludeFolders: {
            from: 'filtering',
            type: OptionType.StringSet,
            spec: { fallback: [] }
        }
    },
    pinned: {
        visibility: {
            from: 'pinned',
            type: OptionType.Boolean,
            spec: { fallback: true }
        },
        pathCompression: {
            from: 'pinned',
            type: OptionType.Boolean,
            spec: { fallback: true }
        }
    },
    validation: {
        duplicates: {
            from: 'validation',
            type: OptionType.Boolean,
            spec: { fallback: true }
        },
        dependencies: {
            from: 'validation',
            type: OptionType.Boolean,
            spec: { fallback: false }
        }
    },
    cockpit: {
        monitor: {
            polling: {
                min: {
                    from: 'cockpit.monitor.polling',
                    type: OptionType.Number,
                    spec: { min: 200, fallback: 322, max: 10_000 }
                },
                cap: {
                    from: 'cockpit.monitor.polling',
                    type: OptionType.Number,
                    spec: { min: 100, fallback: 550, max: 300_000 }
                },
                acceleration: {
                    from: 'cockpit.monitor.polling',
                    type: OptionType.Number,
                    spec: { min: 0.1, fallback: 0.2, max: 1.0 }
                }
            }
        },
        terminals: {
            timeout: {
                from: 'cockpit.terminals',
                type: OptionType.Number,
                spec: { min: 500, fallback: 1_300, max: 12_000 }
            }
        },
        cacheIdleTTL: {
            from: 'cockpit.cacheTTL',
            type: OptionType.Number,
            spec: { min: 1_000, fallback: 666_000, max: 3.6e6 } // 1 минута; 11 минут; 1 час
        }
    },


} satisfies Readonly<Configuration.ConfigSchema<ProjectSettings>>;


function init(section: string) {

    const schema = Configuration.createSchema<ProjectSettings>(SCHEMA);

    return {
        read() {
            return read(section, schema);
        }
    } as const;
}


function read(section: string, schema: Readonly<Configuration.ConfigSchema<ProjectSettings>>) {

    const configuration = Configuration.get(
        schema,
        vscode.workspace.getConfiguration(section)
    );

    // дополнительная валидация polling.cap > polling.min * 1.7
    // see: src/Workspace/Runtime/Monitor.ts
    configuration.cockpit.monitor.polling.cap =
        Math.max(
            configuration.cockpit.monitor.polling.min * 1.7,
            configuration.cockpit.monitor.polling.cap
        );

    return configuration;

}


const ProjectConfiguration = {
    init
};

export default ProjectConfiguration;

export type { ProjectSettings };
