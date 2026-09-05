/** @file WindowSettings/WindowConfigurationSchema.ts */
/** @internal */

import { SETTING } from '../tokens';
import Configuration from '../Configuration';
import WindowConfiguration from './Configuration';

const SCHEMA = Configuration.createSchema<WindowConfiguration>({

    /** Enable diagnostics to surface potential issues with task definitions. */
    Diagnostics: {
        /** When enabled, flags task definitions that share the same label but cannot
         * all be reached — either because a higher-priority origin shadows them,
         * or because multiple definitions within a same origin conflict with each other. */
        shadowedTasks: Configuration.BooleanSpec({
            configKey: SETTING.DIAGNOSTICS.SHADOWED_TASKS,
            fallback: true
        }),
        /** When enabled, flags tasks whose \`dependsOn\` references cannot be resolved —
         * either because the target task does not exist, or because it is not reachable
         * from the current resolution scope. */
        unreachableDependencies: Configuration.BooleanSpec({
            configKey: SETTING.DIAGNOSTICS.UNREACHABLE_DEPENDENCIES,
            fallback: true
        })
    },


    /** Controls which workspace folders appear in the task explorer. */
    Filtering: {
        /** Workspace folders to hide from the task explorer.
         * Each entry should match the folder's display name as shown by VS Code —
         * not the directory name on disk.
         * Also accepts the workspace scope name (e.g. `\"my-project (Workspace)\"`). */
        excludeFolders: Configuration.StringSetSpec({
            configKey: SETTING.FILTERING.EXCLUDE_FOLDERS,
            fallback: []
        })
    },


    /** Controls how the extension monitors running task processes.
     * Uses an adaptive polling interval that grows as more tasks run simultaneously,
     * balancing UI responsiveness against system load. */
    TaskProcessMonitor: {
        /** Adaptive polling curve parameters. The interval starts at \`min\` and climbs
         * toward \`cap\` as the number of concurrently running tasks increases.
         * \`acceleration\` controls how quickly the interval rises. */
        polling: {
            /** Minimum polling interval in milliseconds.
             * Applied when few tasks are running. */
            min: Configuration.NumberSpec({
                configKey: SETTING.PROCESS_MONITOR.POLLING_MIN,
                max: 1_000,
                fallback: 250,
                min: 200
            }),
            /** Maximum polling interval in milliseconds.
             * Once reached, the interval is fixed at this value regardless of
             * how many tasks are running simultaneously.
             * Must be meaningfully larger than \`min\` (at least \`min × 1.7\` is recommended). */
            cap: Configuration.NumberSpec({
                configKey: SETTING.PROCESS_MONITOR.POLLING_CAP,
                max: 3_500,
                fallback: 550,
                min: 340
            }),
            /** Controls how quickly the polling interval grows toward \`cap\`
             * as the number of concurrent tasks increases.
             * Higher values cause the interval to reach \`cap\` sooner,
             * reducing system load at the cost of slower UI updates. */
            acceleration: Configuration.NumberSpec({
                configKey: SETTING.PROCESS_MONITOR.POLLING_ACCEL,
                max: 1.0,
                fallback: 0.2,
                min: 0.1
            })
        }
    },


    /** Controls terminal-related behavior of the extension. */
    Terminals: {
        /** Maximum time in milliseconds to wait for a terminal to report the PID
         * of its running process. If the PID is not provided within this window,
         * the terminal is treated as idle (no active process).  \n
         * Lowering this value improves UI responsiveness, but may cause a running
         * task to be incorrectly shown as finished in some situations. */
        timeout: Configuration.NumberSpec({
            configKey: SETTING.TERMINALS.TIMEOUT,
            max: 12_000,
            fallback: 1_300,
            min: 500
        })
    },

    /** Controls the badge decorations shown on task items in the explorer. */
    FileDecoration: {
        /** Symbol shown when at least one instance of a task is currently running.
         * When multiple instances are active, the badge displays this symbol alongside
         * an instance count or the overflow symbol, depending on available space.  \n
         * *Note*: Use a single visible glyph. Avoid digits — a numeric count
         * may appear next to this symbol. Default: `●` */
        runningSymbol: Configuration.StringSpec({
            configKey: SETTING.DECORATOR.RUNNING_SYMBOL,
            fallback: '●',
            pattern: /^[^\d\s]$/u
        }),
        /** Symbol shown when the instance count exceeds what fits in a two-character badge.
         * VS Code badges are limited to two characters, so when the count reaches 10 or more,
         * this symbol replaces the numeric count. Default: `+` */
        overflowSymbol: Configuration.StringSpec({
            configKey: SETTING.DECORATOR.OVERFLOW_SYMBOL,
            fallback: '+',
            pattern: /^[^\d\s]$/u
        }),
        /** Order of elements within the badge: whether the symbol appears before
         * the instance count (`symbolFirst`) or after it (`countFirst`).
         * Default: `symbolFirst` */
        badgeOrder: Configuration.StringLiteralSpec({
            configKey: SETTING.DECORATOR.BADGE_ORDER,
            fallback: 'symbolFirst',
            values: ['symbolFirst', 'countFirst']
        }),
        /** Symbol shown when a task is not running but its terminal remains open —
         * for example, a completed task that stays visible until replaced by another
         * task in the same terminal or until the terminal is closed.
         * Default: `•` */
        availableSymbol: Configuration.StringSpec({
            configKey: SETTING.DECORATOR.AVAILABLE_SYMBOL,
            fallback: '•',
            pattern: /^[^\d\s]$/u
        })
    }

} as const);


export default SCHEMA;
