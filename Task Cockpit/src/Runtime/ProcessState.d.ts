import type RequestId from './RequestId';
import Timestamp from './Timestamp';


/** Состояние процесса задачи в реестре процессов. */
export interface ProcessState {

    /** Флаг — в состоянии выполнения */
    running: boolean;

    /** Метка времени регистрации */
    registerTimestamp: Timestamp,

    /** Порядковый номер последнего события от системы,
     * результат которого отражён в текущем running.
     *
     * Чьё это running. Не что произошло, а какое обращение к системе
     * последним написало в это поле. */
    requestId: RequestId;
}

export default ProcessState;
