
type SEPARATOR = '\x00\x00\x1F';

declare const ___NodeId: unique symbol;

type NodeId = string & { [___NodeId]: never; };

export default NodeId;
