/** @file TreeModel/index.ts */
/** @module TreeModel */


import Hierarchy from './Hierarchy';
import type NodeSpec from './NodeSpec';

type AnyData = Record<string, unknown>;

declare namespace TreeModel {

    export namespace Hierarchy {
        export type Data<D extends AnyData> = import('./Hierarchy').default.Data<D>;
        export type Branch<D extends AnyData> = import('./Hierarchy').default.Branch<D>;
    }
}

const TreeModel = {

    Hierarchy: {
        buildRoots<D extends AnyData>(specs: ReadonlyArray<Readonly<NodeSpec<D>>>) {
            return Hierarchy.getRoots(Hierarchy.build(specs));
        },
        ...Hierarchy.Node

    } as const,

} as const;


export default TreeModel;
