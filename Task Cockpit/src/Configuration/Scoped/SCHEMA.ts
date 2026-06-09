import {
    Configuration,
    OptionType
} from '../Configuration';
import type Config from './Config';


const SCHEMA = {
    filtering: {
        showHidden: {
            from: 'filtering',
            type: OptionType.Boolean,
            spec: { fallback: false }
        }
    },
    hierarchyConfig: {
        segmentSeparator: {
            from: 'display',
            type: OptionType.String,
            spec: { fallback: '', pattern: /^.?$/ }
        },
        useGroupKind: {
            from: 'display',
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
        }
    }
} satisfies Readonly<Configuration.ConfigSchema<Config>>;


export default SCHEMA;
