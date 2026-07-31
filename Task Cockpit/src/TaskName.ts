import Splitter from './Splitter';

declare const ___TaskName: unique symbol;

/** Номинальный тип для имени задачи.
 *
 * Используется для type safety при работе с коллекциями. */
type TaskName = string & { readonly [___TaskName]: never; };


function formatTaskName(taskName: TaskName, segmentSeparator: string | false = false): string {
    const splitter = Splitter.create(segmentSeparator);
    const segments = splitter.split(taskName);
    return segments.join('・');
}


/** Проверяет, что значение является непустой строкой
 * и может использоваться как ключ. */
function nameIsQualifies(raw: unknown): raw is TaskName {
    return typeof raw === 'string' && raw.length > 0;
}


const TaskName = {
    formatTaskName,
    nameIsQualifies
} as const;

export default TaskName;
