/** @file TaskName.ts */

import { UI } from './common';
import Splitter from './Splitter';

declare const ___TaskName: unique symbol;

/** Номинальный тип для имени задачи.
 *
 * Используется для type safety при работе с коллекциями. */
type TaskName = string & { readonly [___TaskName]: never; };


function formatTaskName(taskName: TaskName, formatData?: { readonly segmentSeparator: string, readonly displaySeparator?: string; } | null | undefined): string {
    if (!formatData) {
        return taskName;
    }
    const splitter = Splitter.create(formatData.segmentSeparator);
    const segments = splitter.split(taskName);
    return segments.join(formatData.displaySeparator || UI.DISPLAY_SEGMENT_SEPARATOR);
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
