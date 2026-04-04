import type { Node } from './';
import * as TC from '../../types';
import Hierarchy from './Hierarchy';

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG

// ── Accessors для getTreeItem ──


interface Icon {
    id: string | undefined;
    color: string | undefined;
}


/** Отображаемое имя: для корней — Section.name, для hierarchy — сегмент. */
function getLabel(node: Node): string {

    switch (node.kind) {

        case TC.EntityKind.Folder:
        case TC.EntityKind.Workspace:
        case TC.EntityKind.Favorites: {
            return node.entity.name;
        }

        case TC.EntityKind.BrokenFavorite: {
            return node.ref.label;
        }

        case TC.EntityKind.Empty: {
            return 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'; // @todo
        }

        case TC.EntityKind.Runnable:
        case TC.EntityKind.Group:
        case TC.EntityKind.RunnableGroup: {
            return Hierarchy.Node.getSegment(node.entity);
        }

        default: {
            const _node: never = node;
            assert(false, `${_node}`); // @todo
            return 'ERROR';
        }
    }

}


function getIcon(node: Node): Readonly<Required<Icon>> {

    switch (node.kind) {

        case TC.EntityKind.Folder: {
            return { id: 'root-folder', color: undefined };
        }

        case TC.EntityKind.Workspace: {
            return { id: 'layers-dot', color: undefined };
        }

        case TC.EntityKind.Favorites: {
            return { id: 'pinned', color: 'badge.background' };
        }

        case TC.EntityKind.BrokenFavorite: {
            return { id: 'dash', color: 'list.warningForeground' };
        }

        case TC.EntityKind.Empty: {
            return { id: 'dash', color: 'list.deemphasizedForeground' };
        }

        case TC.EntityKind.Group: {
            return {
                id: config.useFolderIcon ? 'symbol-folder' : undefined,
                color: undefined
            };
        }

        case TC.EntityKind.Runnable:
        case TC.EntityKind.RunnableGroup: {
            return {
                id: node.entity.icon.id ?? config.defaultIconName,
                color: node.entity.icon.color ?? undefined
            };
        }

        default: {
            const _node: never = node;
            assert(false, `${_node}`); // @todo
            return { id: 'dash', color: 'terminal.ansiRed' };
        }
    }

}