/** @file ResourceStateCoordinator/ResourceConfig/ResourceConfigurationSchema.ts */

import { SETTING_IDS } from '../../common';
import Configuration from '../../Configuration';

import type Config from './ResourceConfig';


const SCHEMA = Configuration.createSchema<Config>({

    Hierarchy: {
        segmentSeparator: Configuration.StringSpec({
            configKey: SETTING_IDS.DISPLAY_SEGMENT_SEPARATOR,
            fallback: '',
            pattern: /^.?$/  // @fixme согласовать с package.json
        }),
        useGroupKind: Configuration.BooleanSpec({
            configKey: SETTING_IDS.DISPLAY_GROUP_BY_TASK_GROUP,
            fallback: false
        }),
        showHidden: Configuration.BooleanSpec({
            configKey: SETTING_IDS.FILTERING_SHOW_HIDDEN,
            fallback: false
        })
    },
    Node: {
        defaultIconName: Configuration.StringSpec({
            configKey: SETTING_IDS.DISPLAY_DEFAULT_ICON_NAME,
            fallback: 'tools',
            pattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
        }),
        tintLabel: Configuration.BooleanSpec({
            configKey: SETTING_IDS.DISPLAY_TINT_LABEL,
            fallback: false
        }),
        useFolderIcon: Configuration.BooleanSpec({
            configKey: SETTING_IDS.DISPLAY_USE_FOLDER_ICON,
            fallback: false
        })
    }
});


declare namespace ResourceConfigurationSchema {
    type SCHEMA = typeof SCHEMA;
    type ConfigKey = keyof Config;
}

const ResourceConfigurationSchema = {
    SCHEMA,
    SECTIONS_BY_KEY: Configuration.collectSections(SCHEMA)
};

export default ResourceConfigurationSchema;
