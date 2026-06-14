import type Hierarchy from '../TreeModel/Hierarchy';
import type TaskName from '../type.d/TaskName';


type LeafPayload = { readonly taskName: TaskName; };


type HierarchyElement = Readonly<
    | Hierarchy.Data<LeafPayload>
    | Hierarchy.Branch<LeafPayload>
>;


declare namespace HierarchyElement {
    export type Data = Hierarchy.Data<LeafPayload>;
    export type Branch = Hierarchy.Branch<LeafPayload>;
}

export default HierarchyElement;
