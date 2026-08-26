/** Параметры, определяющие визуальное отображение элементов дерева. */
interface NodeConfiguration {

    /** Имя иконки по умолчанию для задач без собственного `icon.id`
     * в их definition. Соответствует `taskCockpit.display.defaultIconName`
     * (по умолчанию `'tools'`). */
    defaultIconName: string;

    /** Окрашивать ли текст label задачи в цвет её иконки.
     * Соответствует `taskCockpit.display.tintLabel`. */
    tintLabel: boolean;

    /** Показывать ли иконку папки для промежуточных (intermediate) узлов.
     * Соответствует `taskCockpit.display.useFolderIcon`. */
    useFolderIcon: boolean;
}

export default NodeConfiguration;
