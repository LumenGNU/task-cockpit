/** @file Cockpit/TreeModel/index.ts */
/** @module TreeModel */

import * as TC from '../../types';
import Section from '../TreeModel/Section';
import Hierarchy from '../TreeModel/Hierarchy';

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


// ── Узлы, которых нет в Section — создаются TreeModel ──


interface FolderRoot {
    readonly kind: TC.EntityKind.Folder;
    readonly entity: Section.File;
}

interface WorkspaceRoot {
    readonly kind: TC.EntityKind.Workspace;
    readonly entity: Section.File;
}

interface FavoritesRoot {
    readonly kind: TC.EntityKind.Favorites;
    readonly entity: Section.Favorite;
}

interface BrokenFavorite {
    readonly kind: TC.EntityKind.BrokenFavorite;
    readonly ref: TC.FavoriteRef;
    readonly parentNode: FavoritesRoot;
}

interface Empty {
    readonly kind: TC.EntityKind.Empty;
    readonly parentNode: FolderRoot | WorkspaceRoot;
}

interface Runnable {
    readonly kind: TC.EntityKind.Runnable;
    readonly entity: Section.Item.Runnable;
    readonly parentNode: Group | RunnableGroup | Root;
}

interface Group {
    readonly kind: TC.EntityKind.Group;
    readonly entity: Section.Item.Group;
    readonly parentNode: Group | RunnableGroup | Root;
}

interface RunnableGroup {
    readonly kind: TC.EntityKind.RunnableGroup;
    readonly entity: Section.Item.Group & Section.Item.Runnable;
    readonly parentNode: Group | RunnableGroup | Root;
}

type Root = FolderRoot | WorkspaceRoot | FavoritesRoot;

type Virtual = BrokenFavorite | Empty;

type Item = Runnable | Group | RunnableGroup;

type Child = Virtual | Item;

/** Всё, с чем работает TreeDataProvider. */
export type Node = Root | Child;


const TreeModel = {

    /** Собирает корневые узлы.
     * запрашиваются TreeDataProvider через {@linkcode getChildren}. */
    build(
        entities: ReadonlyArray<Section.Favorite | Section.File>
    ): Root[] {

        const roots: Root[] = [];

        for (const entity of entities) {

            if (!entity.hidden) {
                const root = { kind: entity.kind, entity };
                roots.push(root as Root);
            }
        }

        return roots;
    },


    /** . */
    childFrom(item: Section.Item, parentNode: Group | RunnableGroup | Root): Item {
        if (Section.Child.isRunnable(item)) {
            if (Section.Child.isGroup(item)) {
                return { kind: TC.EntityKind.RunnableGroup, entity: item };
            }
            return { kind: TC.EntityKind.Runnable, entity: item };
        }
        return { kind: TC.EntityKind.Group, entity: item as Section.Item.Group };
    },


    /** Children для TreeDataProvider.getChildren.
     * Ленивый маппинг — Section.Child передаётся как есть. */
    getChildren(node: Node): ReadonlyArray<Child> | undefined {

        switch (node.kind) {

            case TC.EntityKind.Folder:
            case TC.EntityKind.Workspace: {

                const children = node.entity.children;

                return children.length > 0
                    ? children.map((i) => TreeModel.childFrom(i, node))
                    : [{ kind: TC.EntityKind.Empty, parentNode: node }];
            };

            case TC.EntityKind.Favorites: {

                return [
                    ...node.entity.stales.map(ref => ({ kind: TC.EntityKind.BrokenFavorite, ref, parentNode: node }) as const),
                    ...node.entity.children.map((i) => TreeModel.childFrom(i, node))
                ];
            };

            case TC.EntityKind.Group:
            case TC.EntityKind.RunnableGroup: {
                const children = Hierarchy.Node.getBranchChildren(node.entity);

                return children.map((i) => TreeModel.childFrom(i, node));
            };

            // bare leafs
            case TC.EntityKind.BrokenFavorite:
            case TC.EntityKind.Empty:
            case TC.EntityKind.Runnable: {
                return undefined;
            };

            default: {
                const _node: never = node;
                assert(false, `${_node}`); // @todo
                return undefined;
            };
        }
    },









} as const;


export default TreeModel;