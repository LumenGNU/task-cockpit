/** @file TreeModel/index.ts */
/** @module TreeModel */


import growSprouts from './GrowSprouts';

type AnyData = Record<string, unknown>;

declare namespace TreeModel {

    export namespace Hierarchy {
        export type Data<D extends AnyData> = import('./Hierarchy').default.Data<D>;
        export type Branch<D extends AnyData> = import('./Hierarchy').default.Branch<D>;
    }
}

const TreeModel = {
    growSprouts
} as const;


export default TreeModel;
