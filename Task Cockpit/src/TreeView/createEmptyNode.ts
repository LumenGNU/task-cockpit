import EmptyNode from './Node/EmptyNode';
import NodeId from './NodeId';
import type ScopeSection from './Section/ScopeSection';


export type ParentNode =
    | ScopeSection
    // | SubSection
    ;


function createEmptyNode(
    parent: Readonly<ParentNode>,
): Readonly<EmptyNode> {

    return EmptyNode.create(
        NodeId.buildNodeId(parent.nodeId, '_empty_node'), // безопасно поскольку всегда единственный в секции
        {
            label: 'No tasks',
            cause:
                (parent.viewData.stats.total > 0 && parent.viewData.stats.excluded === parent.viewData.stats.total)
                    ? 'Hidden'
                    : 'Empty',
            scopeType: parent.viewData.scopeType,
            scopeKey: parent.viewData.scopeKey
        }
    );
}


export default createEmptyNode;
