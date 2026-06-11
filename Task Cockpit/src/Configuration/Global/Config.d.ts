import type createReader from './createReader';
import type FileDecorationProviderConf from '../../DecorationProvider/Conf';
import type RuntimeConf from '../../Runtime/Conf';


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



    cacheIdleTTL: number;

}


/** Глобальные настройки.
 * Читаются из конфигурации VS Code без привязки к scope ресурса.
 *
 * Используй {@linkcode createReader} для получения читателя.
 * */
interface Config {

    filtering: Filtering;

    pinned: Pinned;

    validation: Validation;

    cockpit: Cockpit;

    runtimeConf: RuntimeConf;

    fileDecorationConf: FileDecorationProviderConf;
}


export default Config;
