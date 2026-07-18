declare const ___Group: unique symbol;

/** Номинальный тип для группы задачи (Build | Test | Clean). */
type Group = ('Build' | 'Test' | 'Clean') & { readonly [___Group]: never; };

export default Group;
