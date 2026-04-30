import * as vscode from 'vscode';
import Configuration, { OptionType } from '../../Configuration';


/** Снимок конфигурации.
 * Поля разделены по назначению — см. {@link ICnf.TreeConfig}
 * и {@link ICnf.NodeConfig}. */
interface ICnf {
    treeConfig: TreeConfig;
    nodeConfig: NodeConfig;
}


/** Параметры, определяющие структуру ветки дерева для scope. */
interface TreeConfig {

    /** Символ-разделитель для разбиения `label` на сегменты иерархии.
     * `false` — иерархия отключена (это же значение используется, когда
     * в настройках указана пустая строка).
     *
     * Соответствует `taskCockpit.display.segmentSeparator`. */
    segmentSeparator: string;

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


/** Читает конфигурацию и возвращает её
 * снимок, разделённый по назначению:
 * - {@linkcode TreeConfig } — определяет структуру дерева
 * - {@linkcode NodeConfig } — визуальное отображение узлов
 *  */
function get(workspaceConfiguration: vscode.WorkspaceConfiguration): Readonly<ICnf> {

    const cfg = Configuration.get(
        {
            treeConfig: {
                segmentSeparator: { path: 'display', type: OptionType.String, spec: { fallback: '', pattern: /^$|^[^\\p{L}\\p{N}\\s]$/ } },
                useGroupKind: { path: 'display', type: OptionType.Boolean, spec: { fallback: false } },
                showHidden: { path: 'filtering', type: OptionType.Boolean, spec: { fallback: false } }
            },
            nodeConfig: {
                defaultIconName: { path: 'display', type: OptionType.String, spec: { fallback: 'tools', pattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/ } },
                tintLabel: { path: 'display', type: OptionType.Boolean, spec: { fallback: false } },
                useFolderIcon: { path: 'display', type: OptionType.Boolean, spec: { fallback: false } },
            }
        } satisfies Configuration.ConfigSchema<ICnf>,
        vscode.workspace.getConfiguration(Configuration.COCKPIT_SECTION_NAME)
    );

    return cfg;
}


const Settings = {
    get
};

export default Settings;
