declare const ___Group: unique symbol;

/** Номинальный тип для группы задачи. */
type Group = string & { readonly [___Group]: never; };

export default Group;
