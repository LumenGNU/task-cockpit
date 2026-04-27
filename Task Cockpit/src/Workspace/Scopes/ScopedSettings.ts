import * as vscode from 'vscode';


/** Снимок конфигурации.
 * Поля разделены по назначению — см. {@link ScopedSettings.TreeConfig}
 * и {@link ScopedSettings.NodeConfig}. */
interface ScopedSettings {
    treeConfig: ScopedSettings.TreeConfig;
    nodeConfig: ScopedSettings.NodeConfig;
}


declare namespace ScopedSettings {

    /** Параметры, определяющие структуру ветки дерева для scope. */
    export interface TreeConfig {

        /** Символ-разделитель для разбиения `label` на сегменты иерархии.
         * `false` — иерархия отключена (это же значение используется, когда
         * в настройках указана пустая строка).
         *
         * Соответствует `taskCockpit.display.segmentSeparator`. */
        segmentSeparator: string | false;

        /** Группировать ли задачи по свойству `group` в task definition.
         * Соответствует `taskCockpit.display.useGroupKind`. */
        useGroupKind: boolean;

        /** Показывать ли задачи, помеченные `hide: true`.
         * Соответствует `taskCockpit.filtering.showHidden`. */
        showHidden: boolean;
    }

    /** Параметры, определяющие визуальное отображение элементов дерева. */
    export interface NodeConfig {

        /** Показывать ли иконку папки для промежуточных (intermediate) узлов.
         * Соответствует `taskCockpit.display.useFolderIcon`. */
        useFolderIcon: boolean;

        /** Имя иконки по умолчанию для задач без собственного `icon.id`
         * в их definition. Соответствует `taskCockpit.display.defaultIconName`
         * (по умолчанию `'tools'`). */
        defaultIconName: string;

        /** Окрашивать ли текст label задачи в цвет её иконки.
         * Соответствует `taskCockpit.display.tintLabel`. */
        tintLabel: boolean;
    }
}


/** Читает конфигурацию и возвращает её
 * снимок, разделённый по назначению:
 * - {@linkcode ScopedSettings.TreeConfig | treeConfig} — определяет структуру дерева
 * - {@linkcode ScopedSettings.NodeConfig | nodeConfig} — визуальное отображение узлов
 *  */
function get(configuration: vscode.WorkspaceConfiguration): Readonly<ScopedSettings> {

    const scopedSettings = Object.create(null) as ScopedSettings;
    scopedSettings.treeConfig = getTreeConfig(configuration);
    scopedSettings.nodeConfig = getNodeConfig(configuration);

    return scopedSettings;
}


function getTreeConfig(configuration: vscode.WorkspaceConfiguration): Readonly<ScopedSettings.TreeConfig> {

    const treeConfig = Object.create(null) as ScopedSettings.TreeConfig;
    treeConfig.segmentSeparator = configuration.get<string>('display.segmentSeparator') || false as const;
    treeConfig.showHidden = configuration.get<boolean>('filtering.showHidden', false);
    treeConfig.useGroupKind = configuration.get<boolean>('display.useGroupKind', false);

    return treeConfig;
}


function getNodeConfig(configuration: vscode.WorkspaceConfiguration): Readonly<ScopedSettings.NodeConfig> {

    const nodeConfig = Object.create(null) as ScopedSettings.NodeConfig;
    nodeConfig.defaultIconName = configuration.get<string>('display.defaultIconName', 'tools');
    nodeConfig.tintLabel = configuration.get<boolean>('display.tintLabel', false);
    nodeConfig.useFolderIcon = configuration.get<boolean>('display.useFolderIcon', false);

    return nodeConfig;
}

const SECTION_NAME = 'taskCockpit' as const;
const ScopedSettings = {
    get,
    sectionName: SECTION_NAME
};

export default ScopedSettings;
