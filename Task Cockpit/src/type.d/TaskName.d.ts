declare const ___TaskName: unique symbol;

/** Номинальный тип для имени задачи.
 *
 * Используется для type safety при работе с коллекциями. */
export type TaskName = string & { readonly [___TaskName]: never; };
