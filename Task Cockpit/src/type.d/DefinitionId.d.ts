declare const ___DefinitionId: unique symbol;


export type DefinitionId = string & {
    readonly [___DefinitionId]: never;
};
