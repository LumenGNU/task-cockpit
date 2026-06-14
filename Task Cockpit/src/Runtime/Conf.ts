
interface Conf {

    readonly monitorConf: {

        /** Параметры адаптивного поллинга опроса системы на работающие задачи */
        readonly polling: {
            /** Минимальный интервал опроса (в мс). */
            readonly min: number;
            /** Максимальный интервал опроса (в мс).
             * Ожидается что будет как минимум cap > min * 1.7  */
            readonly cap: number;
            /** Коэффициент замедления опроса при росте очереди.
             * Чем выше, тем быстрее интервал достигает `cap`. */
            readonly acceleration: number;
        };
    };

    readonly terminalsConf: {
        readonly timeout: number;
    };
}


export default Conf;
