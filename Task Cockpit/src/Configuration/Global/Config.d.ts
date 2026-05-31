
interface Filtering {

    /** папки, исключённые из отображения */
    excludeFolders: Set<string>;
}


interface Pinned {

    /** скрывает/показывает закреплённые задачи */
    visibility: boolean;

    /** режим сжатия путей для закрепленных задач */
    pathCompression: 'off' | 'on' | 'on-aggressive';
}


interface Validation {

    /** выполнять поиск дубликатов лейблов в файлах задач */
    duplicates: boolean;

    /** выполнять поиск потерянных зависимостей в файлах задач */
    dependencies: boolean;
}


interface Cockpit {

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

}


/** Глобальные настройки.
 * Читаются из конфигурации VS Code без привязки к scope ресурса.
 *
 * Используй {@link Config.init} для получения читателя.
 * */
interface Config {

    filtering: Filtering;

    pinned: Pinned;

    validation: Validation;

    cockpit: Cockpit;
}


export default Config;
