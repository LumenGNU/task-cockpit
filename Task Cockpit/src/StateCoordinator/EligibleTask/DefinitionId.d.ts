declare const ___DefinitionId: unique symbol;


type DefinitionId = string & {
    readonly [___DefinitionId]: never;
};

export default DefinitionId;
