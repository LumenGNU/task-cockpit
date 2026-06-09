declare const ___ProcessId: unique symbol;

/** Номинальный тип для идентификатора системного процесса. */
type ProcessId = number & { readonly [___ProcessId]: never; };

export default ProcessId;
