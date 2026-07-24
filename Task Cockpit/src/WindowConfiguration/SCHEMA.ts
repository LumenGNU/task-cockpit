
import {
    ConfigSchema,
    SpecType
} from '../ConfigSchema';
import Config from './Config';

const SCHEMA = {

    /** Enable diagnostics to detect potential issues with task definitions. */
    ValidationConf: {
        /** Check for tasks with duplicate labels and flag them as problematic. */
        duplicates: {
            section: 'validation',
            type: SpecType.Boolean,
            spec: { fallback: true }
        },
        /** Check that tasks referenced in `dependsOn` exist. Missing dependencies will be flagged as problems. */
        dependencies: {
            section: 'validation',
            type: SpecType.Boolean,
            spec: { fallback: true }
        }
    },


    /** Control which tasks and workspace folders are visible in the explorer. */
    Filtering: {
        /** Excludes specified workspace folders from the task explorer.
         * Matches the display name as shown by VS Code, not the directory name.
         * Also accepts the workspace scope name (e.g. `\"my-project (Workspace)\"`). */
        excludeFolders: {
            section: 'filtering',
            type: SpecType.StringSet,
            spec: { fallback: [] }
        }
    },


    Pins: {
        visibility: {
            section: 'display.pins',
            type: SpecType.Boolean,
            spec: { fallback: true }
        },
        pathCompression: {
            section: 'display.pins',
            type: SpecType.StringLiteral,
            spec: { fallback: 'on', values: ['off', 'on', 'on-aggressive'] }
        }
    },

    // cockpit: {

    //     cacheIdleTTL: {
    //         from: 'tasks.cacheTTL',
    //         type: SpecType.Number,
    //         spec: { min: 66_000, fallback: 666_000, max: 6.6e6 } // 1.1 мин; 11.1 мин; 1ч 50мин
    //     }
    // },

    ProcessMonitorConf: {
        /** Параметры адаптивной кривой опроса системы на работающие задачи.
         * Интервал опроса будет увеличиваться от min до cap с скоростью
         * acceleration при росте количества одновременно работающих задач.
         * Позволяет оптимально настроить отзывчивость UI/нагрузку на
         * систему при запуске реально большого количества одновременно
         * работающих задач. */
        polling: {
            /** Минимальный интервал опроса (в мс). */
            min: {
                section: 'monitor.polling',
                type: SpecType.Number,
                spec: { min: 200, fallback: 250, max: 1_000 }
            },
            /** Максимальный интервал опроса (в мс). При достижении
             * интервал опроса фиксируется на этом значении и не будет
             * увеличиваться при росте количества одновременно работающих задач.
             * Ожидается что будет как минимум cap > min * 1.7  */
            cap: {
                section: 'monitor.polling',
                type: SpecType.Number,
                spec: { min: 340, fallback: 550, max: 3_500 }
            },
            /** Коэффициент замедления опроса при росте количества
             * одновременно работающих задач.
             * Чем выше, тем быстрее интервал достигает `cap`. */
            acceleration: {
                section: 'monitor.polling',
                type: SpecType.Number,
                spec: { min: 0.1, fallback: 0.2, max: 1.0 }
            }
        }
    },


    TerminalsConf: {
        /** Максимальное время ожидание разрешения PID от терминала (в мс).
         * Если терминал не отдает PID выполняемого процесса за это время —
         * то такой терминал будет считаться как терминал без процесса.
         * Уменьшение значения может ускорить реакцию UI но, в
         * некоторых ситуациях, может приводить к не корректной интерпретации
         * выполняемой задачи как завершенной. */
        timeout: {
            section: 'terminals',
            type: SpecType.Number,
            spec: { min: 500, fallback: 1_300, max: 12_000 }
        }
    },

    FileDecorationConf: {
        /** The symbol shown when at least one task instance is currently running.
         * If multiple instances run, the badge will show this symbol together with a count
         * or the overflow symbol depending on space.  \n
         * *Notes*: Keep this to a single visible glyph. Avoid digits because counts
         * may be shown alongside the symbol. Default: `●`. */
        runningSymbol: {
            section: 'display.badges',
            type: SpecType.String,
            spec: { fallback: '●', pattern: /^[^\d\s]$/u }
        },
        /** The symbol used when the instance count cannot be shown as a number (VS Code badges
         * are limited to two characters).  \n
         * When the count would require two digits (10+), the
         * badge shows the this symbol instead of the numeric count. Default: `+` */
        overflowSymbol: {
            section: 'display.badges',
            type: SpecType.String,
            spec: { fallback: '+', pattern: /^[^\d\s]$/u }
        },
        /** Controls the order of the two characters in the badge: whether the symbol appears
         * before the instance count (`symbolFirst`) or the count appears before the
         * symbol (`countFirst`). Default: `symbolFirst` */
        badgeOrder: {
            section: 'display.badges',
            type: SpecType.StringLiteral,
            spec: { fallback: 'symbolFirst', values: ['symbolFirst', 'countFirst'] }
        },
        /** The symbol shown when a task is not currently running but its output or result is
         * still available in terminals (for example, a finished task whose terminal is
         * still present). Default: `•` */
        availableSymbol: {
            section: 'display.badges',
            type: SpecType.String,
            spec: { fallback: '•', pattern: /^[^\d\s]$/u }
        }
    },


} satisfies Readonly<ConfigSchema<Config>>;


export default SCHEMA;
