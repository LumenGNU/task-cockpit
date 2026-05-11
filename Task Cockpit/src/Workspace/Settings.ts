/** @file Workspace/Settings.ts */
/** @module Settings */

import * as vscode from 'vscode';
import Configuration, { OptionType } from '../Configuration';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log, table } = Logger.get(module.filename);
// #endregion DEBUG


/** Настройки рабочего пространства.
 * Читаются из конфигурации VS Code без привязки к scope ресурса.
 *
 * Используй {@link WorkspaceSettings.init} для получения читателя.
 * */
interface WorkspaceSettings {

    filtering: {
        /** папки, исключённые из отображения */
        excludeFolders: Set<string>;
    };

    pinned: {
        /** скрывает/показывает закреплённые задачи */
        visibility: boolean;

        /** режим агрессивного сжатия путей для запинованных */
        pathCompression: boolean;
    };

    validation: {
        /** выполнять поиск дубликатов лейблов в файлах задач */
        duplicates: boolean;

        /** выполнять поиск потеряных зависимостей в файлах задач */
        dependencies: boolean;
    };

    runtime: {
        monitor: {

            /** параметры адаптивного поллинга опроса системы на работающие задачи */
            polling: {

                /** минимальный интервал */
                min: number;

                /** максимально достижимий интервал */
                cap: number;

                /** коэффициент ускорения роста интервала (большее значение - раньше cap) */
                acceleration: number;
            };
        };

        terminals: {

            /** Таймаут ожидания запроса process id от терминала. */
            timeout: number;
        };

    };
}


/** Companion object для {@link WorkspaceSettings}.
 * Предоставляет фабрику читателя конфигурации. */
const WorkspaceSettings = {

    /** Создаёт и валидирует схему конфигурации.
     * Вызывается один раз при инициализации модуля.
     *
     * @param section имя секции для чтения.
     * @returns Объект с методом {@link get} для чтения настроек.
     * @throws {AssertionError} Если схема не проходит валидацию.
     * */
    init(section: string) {

        const schema = Configuration.createSchema<WorkspaceSettings>({
            filtering: {
                excludeFolders: { from: 'filtering', type: OptionType.StringSet, spec: { fallback: [] } }
            },
            pinned: {
                visibility: { from: 'pinned', type: OptionType.Boolean, spec: { fallback: true } },
                pathCompression: { from: 'pinned', type: OptionType.Boolean, spec: { fallback: true } }
            },
            validation: {
                duplicates: { from: 'validation', type: OptionType.Boolean, spec: { fallback: true } },
                dependencies: { from: 'validation', type: OptionType.Boolean, spec: { fallback: false } }
            },
            runtime: {
                monitor: {
                    polling: {
                        min: { from: 'runtime.monitor.polling', type: OptionType.Number, spec: { min: 200, fallback: 322, max: 10_000 } },
                        cap: { from: 'runtime.monitor.polling', type: OptionType.Number, spec: { min: 100, fallback: 550, max: 300_000 } },
                        acceleration: { from: 'runtime.monitor.polling', type: OptionType.Number, spec: { min: 0.1, fallback: 0.2, max: 1.0 } }
                    }
                },
                terminals: {
                    timeout: { from: 'runtime.terminals', type: OptionType.Number, spec: { min: 500, fallback: 1_300, max: 12_000 } }
                }
            }
        } as const);

        return {

            /** Читает настройки уровня окна.
             *
             * Не бросает исключений: все поля имеют значения — из конфигурации
             * или из схемы по умолчанию. Числовые значения прижаты к границам.
             *
             * Дополнительное ограничение: `polling.cap >= polling.min * 1.7`
             * (см. `src/Workspace/Runtime/Monitor.ts`).
             * */
            get(): WorkspaceSettings {

                const configuration = Configuration.get(schema, vscode.workspace.getConfiguration(section));

                // дополнительная валидация polling.cap > polling.min * 1.7
                // see: src/Workspace/Runtime/Monitor.ts
                configuration.runtime.monitor.polling.cap =
                    Math.max(
                        configuration.runtime.monitor.polling.min * 1.7,
                        configuration.runtime.monitor.polling.cap
                    );

                return configuration;
            }
        } as const;
    }
} as const;


export default WorkspaceSettings;
