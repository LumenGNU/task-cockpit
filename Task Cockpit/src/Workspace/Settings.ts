import * as vscode from 'vscode';
import Configuration, { OptionType } from '../Configuration';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log, table } = Logger.get(module.filename);
// #endregion DEBUG


interface ICnf {

    readonly filtering: {
        readonly excludeFolders: Set<string>;
    };

    readonly pinned: {
        readonly visibility: boolean;
        readonly pathCompression: boolean;
    };

    readonly validation: {
        readonly duplicates: boolean;
        readonly dependencies: boolean;
    };

    readonly runtime: {
        readonly monitor: {
            readonly polling: {
                readonly min: number;
                readonly cap: number;
                readonly acceleration: number;
            };
        };

        readonly terminals: {
            readonly timeout: number;
        };

    };
}



/** Читает настройки уровня окна (без привязки к scope). */
function get(): Readonly<ICnf> {

    const cfg = Configuration.get(
        {
            filtering: {
                excludeFolders: { path: 'filtering', type: OptionType.StringSet, spec: { fallback: [] } }
            },
            pinned: {
                visibility: { path: 'pinned', type: OptionType.Boolean, spec: { fallback: true } },
                pathCompression: { path: 'pinned', type: OptionType.Boolean, spec: { fallback: true } }
            },
            validation: {
                duplicates: { path: 'validation', type: OptionType.Boolean, spec: { fallback: true } },
                dependencies: { path: 'validation', type: OptionType.Boolean, spec: { fallback: false } }
            },
            runtime: {
                monitor: {
                    polling: {
                        min: { path: 'runtime.monitor.polling', type: OptionType.Number, spec: { min: 200, fallback: 322, max: 10_000 } },
                        cap: { path: 'runtime.monitor.polling', type: OptionType.Number, spec: { min: 100, fallback: 550, max: 300_000 } },
                        acceleration: { path: 'runtime.monitor.polling', type: OptionType.Number, spec: { min: 0.1, fallback: 0.2, max: 1.0 } }
                    }
                },
                terminals: {
                    timeout: { path: 'runtime.terminals', type: OptionType.Number, spec: { min: 500, fallback: 1_300, max: 12_000 } }
                }
            }
        } satisfies Configuration.ConfigSchema<ICnf>,
        vscode.workspace.getConfiguration(Configuration.COCKPIT_SECTION_NAME)
    );

    // дополнительная валидация polling.cap > polling.min * 1.7
    // see: src/Workspace/Runtime/Monitor.ts
    cfg.runtime.monitor.polling.cap =
        Math.max(
            cfg.runtime.monitor.polling.min * 1.7,
            cfg.runtime.monitor.polling.cap
        );

    return cfg;
}


const Settings = {
    get
};

export default Settings;
