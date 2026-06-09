/** Состояние процесса задачи в реестре. */
export interface Process {

    /** Флаг — в состоянии выполнения */
    running: boolean;

    /** Метка времени регистрации */
    timestamp: number;
}

export default Process;
