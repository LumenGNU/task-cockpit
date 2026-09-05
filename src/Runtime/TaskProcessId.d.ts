declare const ___ProcessId: unique symbol;

/** Номинальный тип для идентификатора процесса рантайм-задачи. */
type TaskProcessId = number & { readonly [___ProcessId]: never; };

export default TaskProcessId;
