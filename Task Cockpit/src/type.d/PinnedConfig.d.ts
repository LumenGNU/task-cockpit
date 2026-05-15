/** Конфигурация раздела закреплённых задач. */
export interface PinnedConfig {
    /** Режим видимости раздела. False — безусловно скрыт. */
    visibility: boolean;
    /** Поведение сжатия узлов в разделе. */
    smartPathCompression: boolean;
}
