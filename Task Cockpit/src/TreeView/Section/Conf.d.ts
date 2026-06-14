interface Conf {

    /** Символ-разделитель для разбиения `label` на сегменты иерархии.
     * `false` — иерархия отключена (это же значение используется, когда
     * в настройках указана пустая строка).
     *
     * Соответствует `taskCockpit.display.segmentSeparator`. */
    segmentSeparator: string;

    /** Группировать ли задачи по свойству `group` в task definition.
     * Соответствует `taskCockpit.display.useGroupKind`. */
    useGroupKind: boolean;

}


export default Conf;
