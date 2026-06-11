import { Configuration, OptionType } from '../Configuration';
import Config from './Config';

const SCHEMA = {

    /** Control which tasks and workspace folders are visible in the explorer. */
    filtering: {
        /** Excludes specified workspace folders from the task explorer.
         * Matches the display name as shown by VS Code, not the directory name.
         * Also accepts the workspace scope name (e.g. `\"my-project (Workspace)\"`). */
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
    /** Enable diagnostics to detect potential issues with task definitions. Changes require window reload. */ // @todo все еще require?
    validation: {
        /** Check for tasks with duplicate labels and flag them as problematic.  \n
         * (_Requires window reload to take effect._) */ // @todo все еще Requires?
        duplicates: {
            from: 'validation',
            type: OptionType.Boolean,
            spec: { fallback: true }
        },
        /** [**Experimental**] Check that tasks referenced in `dependsOn` exist. Missing
         * dependencies will be flagged as problems.  \n
         * **Results may be inaccurate or incomplete**. Disable if you encounter incorrect diagnostics.  \n
         * (_Requires window reload to take effect._) */
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
    },

    fileDecorationConf: {
        /** The symbol shown when at least one task instance is currently running.
         * If multiple instances run, the badge will show this symbol together with a count
         * or the overflow symbol depending on space.  \n
         * *Notes*: Keep this to a single visible glyph. Avoid digits because counts
         * may be shown alongside the symbol. Default: `●`. */
        runningSymbol: {
            from: 'display.badges',
            type: OptionType.String,
            spec: { fallback: '●', pattern: /^[^\d\s]$/u }
        },
        /** The symbol used when the instance count cannot be shown as a number (VS Code badges
         * are limited to two characters).  \n
         * When the count would require two digits (10+), the
         * badge shows the this symbol instead of the numeric count. Default: `+` */
        overflowSymbol: {
            from: 'display.badges',
            type: OptionType.String,
            spec: { fallback: '+', pattern: /^[^\d\s]$/u }
        },
        /** Controls the order of the two characters in the badge: whether the symbol appears
         * before the instance count (`symbolFirst`) or the count appears before the
         * symbol (`countFirst`). Default: `symbolFirst` */
        badgeOrder: {
            from: 'display.badges',
            type: OptionType.StringLiteral,
            spec: { fallback: 'symbolFirst', values: ['symbolFirst', 'countFirst'] }
        },
        /** The symbol shown when a task is not currently running but its output or result is
         * still available in terminals (for example, a finished task whose terminal is
         * still present). Default: `•` */
        availableSymbol: {
            from: 'display.badges',
            type: OptionType.String,
            spec: { fallback: '•', pattern: /^[^\d\s]$/u }
        }
    }


} satisfies Readonly<Configuration.ConfigSchema<Config>>;


export default SCHEMA;
