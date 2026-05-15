/** Настройки рабочего пространства.
 * Читаются из конфигурации VS Code без привязки к scope ресурса.
 *
 * Используй {@link ProjectSettings.init} для получения читателя.
 * */
export interface ProjectSettings {

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

        /** выполнять поиск потерянных зависимостей в файлах задач */
        dependencies: boolean;
    };

    cockpit: {
        monitor: {

            /** параметры адаптивного поллинга опроса системы на работающие задачи */
            polling: {

                /** минимальный интервал */
                min: number;

                /** максимально достижимый интервал */
                cap: number;

                /** коэффициент ускорения роста интервала (большее значение - раньше cap) */
                acceleration: number;
            };
        };

        terminals: {

            /** Таймаут ожидания запроса process id от терминала. */
            timeout: number;
        };

        cacheIdleTTL: number;

    };
}
