import type createReader from './createReader';
import type FileDecorationProviderConf from '../../DecorationProvider/Conf';
import type RuntimeConf from '../../Runtime/Conf';
import type TreeModelConf from '../../TreeModel/Conf';





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

    treeModel: TreeModelConf;
}


export default Config;
