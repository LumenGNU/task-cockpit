import type ScopeKey from '../Scope/Key';
import type PinsKey from '../Pins/Key';

const SEPARATOR = '\x00\x00\x1F';

declare const ___NodeId: unique symbol;

type NodeId = (string & { [___NodeId]: never; }) | ScopeKey | PinsKey;

const NodeId = {
    buildNodeId(parentId: NodeId, selfId: string): NodeId {
        return `${parentId}${SEPARATOR}${selfId}` as NodeId;
    }
} as const;


export default NodeId;
