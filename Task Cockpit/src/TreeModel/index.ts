/** @file TreeModel/index.ts */
/** @module TreeModel */


import buildHierarchy from './BuildHierarchy';

type AnyData = Record<string, unknown>;

declare namespace TreeModel {

    export namespace Hierarchy {
        export type Data<D extends AnyData> = import('./Hierarchy').default.Data<D>;
        export type Branch<D extends AnyData> = import('./Hierarchy').default.Branch<D>;
    }
}

const TreeModel = {
    buildHierarchy
} as const;


export default TreeModel;
