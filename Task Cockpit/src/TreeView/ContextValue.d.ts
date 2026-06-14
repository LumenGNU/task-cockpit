import type ScopeType from '../Scope/Type';

type ContextPrefix = 'task-cockpit';


declare namespace ContextValue {

    export namespace Section {

        export type Scope = `${ContextPrefix}:Section:Group:Scope:${ScopeType}`;

        export type Pins = `${ContextPrefix}:Section:Group:Pins`;
    }


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
