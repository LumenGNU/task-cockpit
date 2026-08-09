declare const ___Timestamp: unique symbol;

/** Номинальный тип для непрозрачного идентификатора корреляции запроса. */
type Timestamp = number & { readonly [___Timestamp]: never; };

export default Timestamp;
