import type ScopeType from '../Scope/Type';

type ContextPrefix = 'task-cockpit';


declare namespace ContextValue {

    export type Section = `${ContextPrefix}:Section:${'Pins' | ScopeType}:Group`;


    export namespace Node {
        export type Special = `${ContextPrefix}:Node:Special${':Hidden' | ':Empty'}`;

        export type Intermediate = `${ContextPrefix}:Node:Group`;

        export type Runnable = `${ContextPrefix}${':Node'
            }${'' | ':Group'
            }${':Runnable:Broken' | `:Runnable${'' | ':Running'}${'' | ':Terminals'}`
            }${'' | ':Pinned' | ':Pinned:Stale'
            }`;
    }
}


export default ContextValue;
