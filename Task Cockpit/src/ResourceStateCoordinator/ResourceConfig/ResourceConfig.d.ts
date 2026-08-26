

interface Config {


    /** Параметры, определяющие визуальное отображение элементов дерева. */
    Node: {

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
    };

    Hierarchy: {
        /** Символ-разделитель для разбиения `label` на сегменты иерархии.
         * `false` — иерархия отключена (это же значение используется, когда
         * в настройках указана пустая строка).
         *
         * Соответствует `taskCockpit.display.segmentSeparator`. */
        segmentSeparator: string;

        /** Показывать ли задачи, помеченные `hide: true`.
         * Соответствует `taskCockpit.filtering.showHidden`. */
        showHidden: boolean;

        /** Группировать ли задачи по свойству `group` в task definition.
         * Соответствует `taskCockpit.display.useGroupKind`. */
        // @todo useGroupKind -> prependGroupKind ???
        useGroupKind: boolean;
    };


}


export default Config;
