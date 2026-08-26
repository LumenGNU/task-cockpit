interface RuntimeStats {
    /** Общее количество процессов у задачи */
    total: number;
    /** Количество процессов задачи в состоянии выполнения */
    running: number;
}

export default RuntimeStats;
