declare const ___ProcessId: unique symbol;

/** Номинальный тип для идентификатора системного процесса. */
export type ProcessId = number & { readonly [___ProcessId]: never; };
