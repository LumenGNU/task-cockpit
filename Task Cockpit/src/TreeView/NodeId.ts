import type ScopeKey from '../Scope/Key';

const SEPARATOR = '\x1F\x00\x00';

declare const ___NodeId: unique symbol;

type NodeId = (string & { [___NodeId]: never; }) | ScopeKey;

const NodeId = {
    buildNodeId(parentId: NodeId, selfId: string): NodeId {
        return `${parentId}${SEPARATOR}${selfId}` as NodeId;
    }
} as const;


export default NodeId;
