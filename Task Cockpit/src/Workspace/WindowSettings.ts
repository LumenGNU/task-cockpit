
import * as vscode from 'vscode';

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log, table } = Logger.get(module.filename);
// #endregion DEBUG


/** Читает настройки уровня окна (без привязки к scope). */
function get(configSection: string): Readonly<WindowSettings> {

    const configuration = vscode.workspace.getConfiguration(configSection);

    return {
        excludeFolders: new Set(configuration.get<string[]>('filtering.excludeFolders', [])),
        // pinnedRecord: configuration.get<>('pinnedTasks.??????', ??????),
        pinnedConfig: {
            visibility: configuration.get<boolean>('pinnedTasks.visibility', true),
            smartPathCompression: configuration.get<boolean>('pinnedTasks.smartPathCompression', true)
        },
        validation: {
            duplicateLabels: configuration.get<boolean>('validation.duplicateLabels', true),
            dependencies: configuration.get<boolean>('validation.dependencies', false)
        }
    };
}

interface WindowSettings {
    readonly excludeFolders: Set<string>;
    // readonly pinnedRecord: WindowSettings.PinnedRecord;
    readonly pinnedConfig: WindowSettings.PinnedConfig;
    readonly validation: WindowSettings.Validation;
}

declare namespace WindowSettings {

    // // {
    // //     "version": 1,
    // //     "scopes": {
    // //         "scope-identify-1": ["task-a", "task-b"],
    // //         "scope-identify-2": ["task-c"]
    // //     }
    // // }
    // export type PinnedRecord = {
    //     readonly version: number;
    //     readonly scopes: Map<string, Set<string>>;
    // };

    export interface PinnedConfig {
        readonly visibility: boolean;
        readonly smartPathCompression: boolean;
    }

    export interface Validation {
        readonly duplicateLabels: boolean;
        readonly dependencies: boolean;
    }
}

const WindowSettings = {
    get
};

