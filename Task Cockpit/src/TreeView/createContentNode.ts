import * as assert from 'node:assert/strict';
import Hierarchy from '../TreeModel/Hierarchy';
import IntermediateNode from './Node/IntermediateNode';
import NodeId from './NodeId';
import RunnableNode from './Node/RunnableNode';
import type HierarchyElement from './HierarchyElement';
import type ScopeSection from './Section/ScopeSection';


export type ParentNode =
    | ScopeSection
    // | SubSection
    | RunnableNode
    | IntermediateNode
    ;


function createContentNode(
    parent: Readonly<ParentNode>,
    hierarchy: Readonly<HierarchyElement>
): Readonly<RunnableNode | IntermediateNode> {

    // Сегмент → label — всегда уникальный среди детей
    const label = Hierarchy.Node.getSegment(hierarchy);

    const children: ReadonlyArray<Readonly<HierarchyElement>> | null =
        (Hierarchy.Node.isBranch(hierarchy))
            ? Hierarchy.Node.getBranchChildren(hierarchy)
            : null;

    if (Hierarchy.Node.isData(hierarchy)) {

        return RunnableNode.create(
            NodeId.buildNodeId(parent.nodeId, label),
            {
                label,
                children,
                scopeKey: parent.viewData.scopeKey,
                taskName: hierarchy.taskName
            }
        );
    }

    assert.ok(children, `ContentNode: node "${label}" is neither data nor branch — malformed hierarchy`);

    return IntermediateNode.create(
        NodeId.buildNodeId(parent.nodeId, label),
        {
            label,
            children,
            scopeKey: parent.viewData.scopeKey,
        });
}


export default createContentNode;
