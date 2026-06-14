
import NodeConf from '../../TreeView/Node/Conf';

interface Filtering {
    /** Показывать ли задачи, помеченные `hide: true`.
     * Соответствует `taskCockpit.filtering.showHidden`. */
    showHidden: boolean;
}








interface Config {
    filtering: Filtering,
    hierarchyConf: HierarchyConf;
    nodeConf: NodeConf;
}


export default Config;
