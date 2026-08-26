declare const ___RequestId: unique symbol;

/** Номинальный тип для непрозрачного идентификатора корреляции запроса. */
type RequestId = number & { readonly [___RequestId]: never; };

export default RequestId;
