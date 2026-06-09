
interface Props {

    readonly monitor: {
        readonly polling: {
            /** Минимальный интервал опроса (в мс). */
            readonly min: number;
            /** Максимальный интервал опроса (в мс).
             * Ожидается что будет как минимум cap > min * 1.7  */
            readonly cap: number;
            /** Коэффициент замедления опроса при росте очереди.
             * Чем выше, тем быстрее мы достигаем `cap`. */
            readonly acceleration: number;
        };
    };

    readonly terminals: {
        readonly timeout: number;
    };
}


export default Props;
