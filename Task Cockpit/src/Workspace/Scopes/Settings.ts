import * as vscode from 'vscode';
import Configuration, { OptionType } from '../../Configuration';


/** Настройки для кокретной скопы.
 * Поля разделены по назначению — см. {@link ScopeSettings.TreeConfig}
 * и {@link ScopeSettings.NodeConfig}. */
interface ScopeSettings {

    /** Параметры, определяющие структуру ветки дерева для scope. */
    treeConfig: {

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
    };

    /** Параметры, определяющие визуальное отображение элементов дерева. */
    nodeConfig: {

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
    };
}


const ScopeSettings = {

    init(section: string) {

        const schema = Configuration.createSchema<ScopeSettings>({
            treeConfig: {
                segmentSeparator: { from: 'display', type: OptionType.String, spec: { fallback: '', pattern: /^.*$/ } },
                useGroupKind: { from: 'display', type: OptionType.Boolean, spec: { fallback: false } },
                showHidden: { from: 'filtering', type: OptionType.Boolean, spec: { fallback: false } }
            },
            nodeConfig: {
                defaultIconName: { from: 'display', type: OptionType.String, spec: { fallback: 'tools', pattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/ } },
                tintLabel: { from: 'display', type: OptionType.Boolean, spec: { fallback: false } },
                useFolderIcon: { from: 'display', type: OptionType.Boolean, spec: { fallback: false } },
            }
        } as const);

        return {

            get(scope: vscode.WorkspaceFolder | vscode.TaskScope.Workspace): ScopeSettings {
                const configuration =
                    Configuration.get(
                        schema,
                        vscode.workspace.getConfiguration(
                            section,
                            (scope === vscode.TaskScope.Workspace) ? undefined : scope
                        )
                    );
                return configuration;
            }

        } as const;

    }


} as const;


export default ScopeSettings;
