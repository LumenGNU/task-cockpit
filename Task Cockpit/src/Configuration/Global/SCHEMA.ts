import { Configuration, OptionType } from '../Configuration';
import Config from './Config';

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
            type: OptionType.StringLiteral,
            spec: { fallback: 'on', values: ['off', 'on', 'on-aggressive'] }
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
                    from: 'monitor.polling',
                    type: OptionType.Number,
                    spec: { min: 200, fallback: 250, max: 1_000 }
                },
                cap: {
                    from: 'monitor.polling',
                    type: OptionType.Number,
                    spec: { min: 340, fallback: 550, max: 3_500 }
                },
                acceleration: {
                    from: 'monitor.polling',
                    type: OptionType.Number,
                    spec: { min: 0.1, fallback: 0.2, max: 1.0 }
                }
            }
        },
        terminals: {
            timeout: {
                from: 'terminals',
                type: OptionType.Number,
                spec: { min: 500, fallback: 1_300, max: 12_000 }
            }
        },
        cacheIdleTTL: {
            from: 'tasks.cacheTTL',
            type: OptionType.Number,
            spec: { min: 66_000, fallback: 666_000, max: 6.6e6 } // 1.1 мин; 11.1 мин; 1ч 50мин
        }
    }


} satisfies Readonly<Configuration.ConfigSchema<Config>>;


export default SCHEMA;
