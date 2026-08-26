
type ContextPrefix = '';


declare namespace ContextValue {

    export type Section = `${ContextPrefix}:Section:${'Pins' | 'Global' | 'Workspace' | 'Folder' | 'Stale'}:Group`;


    export namespace Node {
        export type Special = `${ContextPrefix}:Node:Special${':Hidden' | ':Empty'}`;

        export type Intermediate = `${ContextPrefix}:Node:Group`;

        export type Runnable = `${ContextPrefix}:Node${'' | ':Group'}:Runnable${'' | ':Broken-NoDefinition' | ':Broken-NotExecutable'
            }${'' | ':Terminals' | ':Running:Terminals'
            }`;
    }
}


export default ContextValue;
