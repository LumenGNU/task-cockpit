import {
    Configuration,
    OptionType
} from '../Configuration';
import type Config from './Config';


const SCHEMA = {
    Filtering: {
        showHidden: {
            from: 'filtering',
            type: OptionType.Boolean,
            spec: { fallback: false }
        }
    },
    Hierarchy: {
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
    Node: {
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
