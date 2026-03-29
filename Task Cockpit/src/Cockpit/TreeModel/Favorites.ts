
import type * as TC from '../../types';
import Hierarchy from './Hierarchy';






declare namespace Favorites {

    export interface Entity {
        readonly name: 'Pinned';
        readonly kind: 'Favorites';
        readonly hidden: boolean;
        readonly children: Array<Favorites.Child>;
    }


    export type Child = Hierarchy.Node<TC.TaskDefinition, TC.File>;


}
