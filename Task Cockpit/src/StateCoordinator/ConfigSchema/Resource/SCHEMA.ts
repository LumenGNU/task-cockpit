
import {
    type ConfigSchema,
    SpecType
} from '../ConfigSchema';
import type Config from './Config';


const SCHEMA = {
    Filtering: {
        showHidden: {
            section: 'filtering',
            type: SpecType.Boolean,
            spec: { fallback: false }
        }
    },
    Hierarchy: {
        segmentSeparator: {
            section: 'display',
            type: SpecType.String,
            spec: { fallback: '', pattern: /^.?$/ }
        },
        useGroupKind: {
            section: 'display',
            type: SpecType.Boolean,
            spec: { fallback: false }
        }
    },
    Node: {
        defaultIconName: {
            section: 'display',
            type: SpecType.String,
            spec: { fallback: 'tools', pattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/ }
        },
        tintLabel: {
            section: 'display',
            type: SpecType.Boolean,
            spec: { fallback: false }
        },
        useFolderIcon: {
            section: 'display',
            type: SpecType.Boolean,
            spec: { fallback: false }
        }
    }
} satisfies Readonly<ConfigSchema<Config>>;


export default SCHEMA;
