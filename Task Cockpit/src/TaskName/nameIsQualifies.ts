import type TaskName from './TaskName';

/** Проверяет, что значение является непустой строкой
 * и может использоваться как ключ. */
function nameIsQualifies(raw: unknown): raw is TaskName {
    return typeof raw === 'string' && raw.length > 0;
}

export default nameIsQualifies;
