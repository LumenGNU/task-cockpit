import type * as TC from '../../types';
import Hierarchy from './Hierarchy';

export interface Entity {

    readonly name: string;
    readonly kind: 'Workspace' | 'Folder' | 'Favorites';
    readonly hidden: boolean;
    readonly lookup: (...segments: ReadonlyArray<string>) => Entity.Child | undefined;
    readonly lookupById: (taskId: TC.TaskID) => Entity.Child | undefined;
    readonly children: Array<Entity.Child>;

}


export declare namespace Entity {
    export type Child = Hierarchy.Node<TC.TaskDefinition, TC.File>;
}



const Entity = {
    Child: {

        isRunnable(node: Readonly<Entity.Child>): node is typeof node & TC.TaskDefinition {
            return Hierarchy.Node.isData<TC.TaskDefinition, TC.File>(node);
        },

        isGroup(node: Readonly<Entity.Child>): node is Hierarchy.ActuallyBranch<TC.TaskDefinition, TC.File> {
            return Hierarchy.Node.isBranch<TC.TaskDefinition, TC.File>(node);
        },

        getChildren(
            node: Hierarchy.ActuallyBranch<TC.TaskDefinition, TC.File>
        ): Array<Readonly<Entity.Child>> {
            return Hierarchy.Node.getBranchChildren(node);
        }

    } as const,
} as const;
