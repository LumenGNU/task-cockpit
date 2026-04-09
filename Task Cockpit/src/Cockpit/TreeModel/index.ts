/** @file Cockpit/TreeModel/index.ts */
/** @module TreeModel */
import * as vscode from 'vscode';
import * as TC from '../../types';
import Section from '../TreeModel/Section';
import Hierarchy from '../TreeModel/Hierarchy';

// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../../Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


interface Icon {
    id: string | undefined;
    color?: string | undefined;
    tintLabel?: boolean;
}

// Узлы, которых нет в Section — создаются TreeModel


type FolderRoot = Omit<Section.Source, 'kind'> & { kind: TC.EntityKind.Folder; nodeConfig: TC.NodeConfig; };
type WorkspaceRoot = Omit<Section.Source, 'kind'> & { kind: TC.EntityKind.Workspace; nodeConfig: TC.NodeConfig; };

type PinnedFolder = Section.PinnedFolder & {
    nodeConfig: TC.NodeConfig;
};

type PinnedSingle = Section.PinnedSingle & { nodeConfig: TC.NodeConfig; };
type PinnedMulti = Section.PinnedMulti & { nodeConfig: TC.NodeConfigByFile; };


interface BrokenPinned {
    readonly kind: TC.EntityKind.BrokenPinned;
    readonly ref: TC.PinnedStale;
    readonly parentNode: PinnedSingle | PinnedMulti;
}

interface Empty {
    readonly kind: TC.EntityKind.Empty;
    readonly parentNode: FolderRoot | WorkspaceRoot;
}

interface Runnable {
    readonly kind: TC.EntityKind.Runnable;
    readonly entity: Hierarchy.Data<TC.TaskDefinition, TC.File>;
    readonly parentNode: ParentNode;
}

interface Group {
    readonly kind: TC.EntityKind.Group;
    readonly entity: Hierarchy.Branch<TC.TaskDefinition, TC.File>;
    readonly parentNode: ParentNode;
}

interface RunnableGroup {
    readonly kind: TC.EntityKind.RunnableGroup;
    readonly entity: Hierarchy.Data<TC.TaskDefinition, TC.File> & Hierarchy.Branch<TC.TaskDefinition, TC.File>;
    readonly parentNode: ParentNode;
}

/** Узел, у которого могут быть children из childFrom(). */
type ParentNode =
    | PinnedFolder
    | PinnedSingle
    | FolderRoot
    | Group
    | RunnableGroup
    | WorkspaceRoot
    ;

/** Результат childFrom() — узлы иерархии задач. */
type HierarchyChild =
    | Group
    | Runnable
    | RunnableGroup
    ;

declare namespace TreeModel {
    /** Всё, с чем работает TreeDataProvider. */
    type Node =
        | BrokenPinned
        | Empty
        | PinnedFolder
        | TopRoot
        | HierarchyChild
        ;

    type TopRoot =
        | PinnedMulti
        | PinnedSingle
        | FolderRoot
        | WorkspaceRoot
        ;
}

interface Props {
    id: string;
    label: string;
    iconPath: vscode.IconPath | undefined;
    description: string | undefined;
    collapsibleState: vscode.TreeItemCollapsibleState;
}


const TreeModel = {

    /** Собирает корневые узлы.
     * запрашиваются TreeDataProvider через {@linkcode getChildren}. */
    build(
        data: {
            scopes: ReadonlyArray<TC.Scope>,
            pinnedConfig: Readonly<TC.PinnedConfig>,
            definitionMap: Readonly<TC.DefinitionsByFile>,
            treeConfigMap: Readonly<TC.TreeConfigByFile>,
            nodeConfigMap: Readonly<TC.NodeConfigByFile>,
            excludeFolders: ReadonlySet<TC.FolderName>;
        }
    ): Array<TreeModel.TopRoot> {

        const entities = Section.buildEntities(
            data.scopes,
            data.pinnedConfig,
            data.definitionMap,
            data.treeConfigMap
        );

        const roots: Array<TreeModel.TopRoot> = [];

        for (const entity of entities) {

            if (entity.kind === TC.EntityKind.PinnedSingle || entity.kind === TC.EntityKind.PinnedMulti) {

                if (data.pinnedConfig.visibility === TC.PinnedVisibility.HIDE) {
                    continue;
                }

                if (entity.children.length === 0 && entity.stales.length === 0) {
                    continue;
                }

                if (entity.kind === TC.EntityKind.PinnedSingle) {
                    roots.push({ ...entity, nodeConfig: data.nodeConfigMap.get(entity.tasksFile)! });
                }
                else {
                    roots.push({ ...entity, nodeConfig: data.nodeConfigMap });
                }

            }
            else {
                if (data.excludeFolders.has(entity.name)) {
                    continue;
                }
                roots.push({ ...entity, nodeConfig: data.nodeConfigMap.get(entity.tasksFile)! });
            }
        }

        return roots;
    },

    /** Children для TreeDataProvider.getChildren.
     * Ленивый маппинг — Section.Child передаётся как есть. */
    getChildren(node: TreeModel.Node): Array<BrokenPinned | Empty | PinnedFolder | HierarchyChild> | undefined {

        switch (node.kind) {

            case TC.EntityKind.Folder:
            case TC.EntityKind.Workspace: {
                const children = node.children;
                return children.length > 0
                    ? children.map((i) => childFrom(i, node))
                    : [{ kind: TC.EntityKind.Empty, parentNode: node }];
            }

            case TC.EntityKind.PinnedSingle: {
                return [
                    ...node.stales.map(ref => ({ kind: TC.EntityKind.BrokenPinned, ref, parentNode: node }) as const),
                    ...node.children.map((sectionItem) => childFrom(sectionItem, node))
                ];
            };

            case TC.EntityKind.PinnedMulti: {
                return [
                    ...node.stales.map(ref => ({ kind: TC.EntityKind.BrokenPinned, ref, parentNode: node }) as const),
                    ...node.children.map((pinnedFolder) => ({ ...pinnedFolder, nodeConfig: node.nodeConfig.get(pinnedFolder.tasksFile)! }))
                ];
            }

            case TC.EntityKind.PinnedFolder: {
                return node.children.map((i) => childFrom(i, node));
            }

            case TC.EntityKind.Group:
            case TC.EntityKind.RunnableGroup: {

                const children = Hierarchy.Node.getBranchChildren(node.entity);

                return children.map((i) => childFrom(i, node));
            };

            // bare leafs
            case TC.EntityKind.BrokenPinned:
            case TC.EntityKind.Empty:
            case TC.EntityKind.Runnable: {
                return undefined;
            };

            // #region DEBUG
            default: {
                const _node: never = node;
                assert(false, `${_node}`); // @todo
                return undefined;
            };
            // #endregion DEBUG
        }
    },


    // #region TEST
    // Формирует ASCII дерево. Вызывает formatter на каждом узле.
    printTree(
        roots: ReadonlyArray<Readonly<TreeModel.TopRoot>>,
        formatter: (node: TreeModel.Node) => string =
            (node) => {
                switch (node.kind) {
                    case TC.EntityKind.Folder: {
                        return `[F[ ${node.name} ]]`;
                    }

                    case TC.EntityKind.Workspace: {
                        return `[W[ ${node.name} ]]`;
                    }

                    case TC.EntityKind.PinnedSingle:
                    case TC.EntityKind.PinnedMulti: {
                        return `[★[ ${node.name} ]]`;
                    }

                    case TC.EntityKind.PinnedFolder: {
                        return `[ ${node.name} ]`;
                    }

                    case TC.EntityKind.BrokenPinned: {
                        return `« ✗ ${node.ref.label} »`;
                    }

                    case TC.EntityKind.Empty: {
                        return '« No tasks to display in this scope »';
                    }

                    case TC.EntityKind.Group: {
                        return Hierarchy.Node.getSegment(node.entity);
                    }

                    case TC.EntityKind.Runnable:
                    case TC.EntityKind.RunnableGroup: {
                        return `▶ ${Hierarchy.Node.getSegment(node.entity)}`;
                    }

                    default: {
                        const _node: never = node;
                        return '== ERROR ==';
                    }
                }
            }
    ): string {

        const lines: string[] = [];

        const walk = (node: TreeModel.Node, prefix: string, isLast: boolean, isRoot: boolean): void => {

            const connector = isRoot ? '' : isLast ? '└─ ' : '├─ ';
            lines.push(prefix + connector + formatter(node));

            const children = TreeModel.getChildren(node);
            if (!children) return;

            const childPrefix = isRoot ? ' ' : prefix + (isLast ? '   ' : '│  ');

            for (let i = 0; i < children.length; i++) {
                walk(children[i], childPrefix, i === children.length - 1, false);
            }
        };

        for (let i = 0; i < roots.length; i++) {
            if (i > 0) lines.push('');
            walk(roots[i], '', true, true);
        }

        return lines.join('\n');
    },

    // #endregion TEST

    describe(node: TreeModel.Node): Props {

        const props = Object.create(null) as Props;

        switch (node.kind) {

            case TC.EntityKind.Workspace:
            case TC.EntityKind.Folder: {
                props.id = node.tasksFile;
                props.label = node.name;
                props.iconPath =
                    node.kind === TC.EntityKind.Folder
                        ? new vscode.ThemeIcon('root-folder', undefined)
                        : new vscode.ThemeIcon('layers', undefined);
                props.description = undefined;
                props.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                break;
            }

            case TC.EntityKind.PinnedFolder:
            case TC.EntityKind.PinnedSingle:
            case TC.EntityKind.PinnedMulti: {
                props.id = rootPrefix(node);
                props.label = node.name;
                props.iconPath =
                    node.kind === TC.EntityKind.PinnedFolder
                        ? new vscode.ThemeIcon('symbol-folder', undefined)
                        : new vscode.ThemeIcon('pinned', new vscode.ThemeColor('list.highlightForeground')); // @todo может без цвета?
                props.description = undefined;
                props.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                break;
            }

            case TC.EntityKind.Empty: {
                props.id = `${rootPrefix(node.parentNode)}\0\0EMPTY-MARKER\0`;
                props.label = 'No tasks to display in this scope';
                props.iconPath = new vscode.ThemeIcon('dash', new vscode.ThemeColor('list.deemphasizedForeground'));
                props.description = undefined;
                props.collapsibleState = vscode.TreeItemCollapsibleState.None;
                break;
            }

            case TC.EntityKind.BrokenPinned: {
                props.id = `${rootPrefix(node.parentNode)}\0\0BROKEN-MARKER\0${node.ref.scopeName}\0${node.ref.label}`;
                props.label = node.ref.label;
                props.iconPath = new vscode.ThemeIcon('dash', new vscode.ThemeColor('list.warningForeground'));
                props.description = undefined;
                props.collapsibleState = vscode.TreeItemCollapsibleState.None;
                break;
            }

            case TC.EntityKind.Group: {
                const { root, segments } = walkToRoot(node);
                props.id = segments.join('\0');
                props.label = Hierarchy.Node.getSegment(node.entity);
                props.iconPath = root.nodeConfig.useFolderIcon ? new vscode.ThemeIcon('symbol-folder', undefined) : undefined;
                props.description = undefined;
                props.collapsibleState = (root.kind === TC.EntityKind.PinnedSingle || root.kind === TC.EntityKind.PinnedFolder)
                    ? vscode.TreeItemCollapsibleState.Expanded
                    : vscode.TreeItemCollapsibleState.Collapsed;
                break;
            }

            case TC.EntityKind.RunnableGroup:
            case TC.EntityKind.Runnable: {
                const root = getRootGroup(node);
                props.id = `${rootPrefix(root)}task://${node.entity.id}`;
                props.label = Hierarchy.Node.getSegment(node.entity);
                props.iconPath = new vscode.ThemeIcon(
                    node.entity.icon.id ?? root.nodeConfig.defaultIconName,
                    node.entity.icon.color ? new vscode.ThemeColor(node.entity.icon.color) : undefined
                );
                const flags: string[] = [];
                if (node.entity.hidden) flags.push('Hidden');
                if (node.entity.group?.isDefault) flags.push('Default');
                if (node.entity.isBackground) flags.push('Background');
                props.description = (flags.length > 0) ? `( ${flags.join(', ')} )` : undefined;
                props.collapsibleState
                    = (node.kind === TC.EntityKind.Runnable)
                        ? vscode.TreeItemCollapsibleState.None
                        : (root.kind === TC.EntityKind.PinnedSingle || root.kind === TC.EntityKind.PinnedFolder)
                            ? vscode.TreeItemCollapsibleState.Expanded
                            : vscode.TreeItemCollapsibleState.Collapsed;
                break;
            }

            // #region DEBUG
            default: {
                const _node: never = node;
                assert(false, `${_node}`); // @todo
                props.id = '(ERROR)';
            }
            // #endregion DEBUG
        }

        return props;


    },

    Accessors: {

        getLabel(node: HierarchyChild): string {
            return Hierarchy.Node.getSegment(node.entity);
        }

        /*
        getLabel(node: TreeModel.Node): string {

            switch (node.kind) {

                case TC.EntityKind.Folder:
                case TC.EntityKind.Workspace:
                case TC.EntityKind.FavoriteFolder:
                case TC.EntityKind.FavoritesSingle:
                case TC.EntityKind.FavoritesMulti: {
                    return node.name;
                }

                case TC.EntityKind.BrokenFavorite: {
                    return node.ref.label;
                }

                case TC.EntityKind.Empty: {
                    return 'No tasks to display in this scope';
                }

                case TC.EntityKind.Runnable:
                case TC.EntityKind.Group:
                case TC.EntityKind.RunnableGroup: {
                    return Hierarchy.Node.getSegment(node.entity);
                }

                // #region DEBUG
                default: {
                    const _node: never = node;
                    assert(false, `${_node}`); // @todo
                    return 'ERROR';
                }
                // #endregion DEBUG
            }

        },

        getIcon(node: TreeModel.Node): Readonly<Icon> {

            switch (node.kind) {

                case TC.EntityKind.Folder: {
                    return { id: 'root-folder' };
                }

                case TC.EntityKind.Workspace: {
                    return { id: 'layers' };
                }

                case TC.EntityKind.FavoritesSingle:
                case TC.EntityKind.FavoritesMulti: {
                    return { id: 'pinned', color: 'list.highlightForeground' }; // @todo может без цвета?
                }

                case TC.EntityKind.BrokenFavorite: {
                    return { id: 'dash', color: 'list.warningForeground' };
                }

                case TC.EntityKind.Empty: {
                    return { id: 'dash', color: 'list.deemphasizedForeground' };
                }

                case TC.EntityKind.FavoriteFolder: {
                    return { id: 'symbol-folder' };
                }

                case TC.EntityKind.Group: {

                    return { id: getRootGroup(node).nodeConfig.useFolderIcon ? 'symbol-folder' : undefined };
                }

                case TC.EntityKind.Runnable:
                case TC.EntityKind.RunnableGroup: {

                    const { defaultIconName, tintLabel } = getRootGroup(node).nodeConfig;

                    return { id: node.entity.icon.id ?? defaultIconName, color: node.entity.icon.color ?? undefined, tintLabel };
                }

                // #region DEBUG
                default: {
                    const _node: never = node;
                    assert(false, `${_node}`); // @todo
                    return { id: 'dash', color: 'terminal.ansiRed' };
                }
                // #endregion DEBUG
            }

        },

        getCollapsibleState(node: TreeModel.Node): vscode.TreeItemCollapsibleState {

            switch (node.kind) {

                case TC.EntityKind.Folder:
                case TC.EntityKind.Workspace:
                case TC.EntityKind.FavoritesSingle:
                case TC.EntityKind.FavoritesMulti:
                case TC.EntityKind.FavoriteFolder: {
                    return vscode.TreeItemCollapsibleState.Expanded;
                }

                case TC.EntityKind.Group:
                case TC.EntityKind.RunnableGroup: {
                    const root = getRootGroup(node);
                    switch (root.kind) {
                        case TC.EntityKind.FavoritesSingle:
                        case TC.EntityKind.FavoriteFolder: {
                            return vscode.TreeItemCollapsibleState.Expanded;
                        }

                        default: {
                            return vscode.TreeItemCollapsibleState.Collapsed;
                        }
                    }
                }

                case TC.EntityKind.BrokenFavorite:
                case TC.EntityKind.Empty:
                case TC.EntityKind.Runnable: {
                    return vscode.TreeItemCollapsibleState.None;
                }

                // #region DEBUG
                default: {
                    const _node: never = node;
                    assert(false, `${_node}`); // @todo
                    return vscode.TreeItemCollapsibleState.Expanded;
                }
                // #endregion DEBUG
            }
        },

        getDescription(node: TreeModel.Node): string | undefined {

            switch (node.kind) {

                case TC.EntityKind.Folder:
                case TC.EntityKind.Workspace:
                case TC.EntityKind.FavoritesSingle:
                case TC.EntityKind.FavoritesMulti:
                case TC.EntityKind.FavoriteFolder:
                case TC.EntityKind.Group:
                case TC.EntityKind.BrokenFavorite:
                case TC.EntityKind.Empty: {
                    return undefined;
                }

                case TC.EntityKind.RunnableGroup:
                case TC.EntityKind.Runnable: {

                    const flags: string[] = [];
                    if (node.entity.hidden) flags.push('Hidden');
                    if (node.entity.group?.isDefault) flags.push('Default');
                    if (node.entity.isBackground) flags.push('Background');

                    return (flags.length > 0) ? `( ${flags.join(', ')} )` : undefined;
                }

                // #region DEBUG
                default: {
                    const _node: never = node;
                    assert(false, `${_node}`); // @todo
                    return '(ERROR)';
                }
                // #endregion DEBUG
            }

        },

        getID(node: TreeModel.Node): string {
            switch (node.kind) {

                case TC.EntityKind.Workspace:
                case TC.EntityKind.Folder: {
                    return node.tasksFile;
                }

                case TC.EntityKind.FavoritesSingle:
                case TC.EntityKind.FavoritesMulti: {
                    return rootPrefix(node);
                }

                case TC.EntityKind.FavoriteFolder: {
                    return rootPrefix(node);
                }

                case TC.EntityKind.Empty: {
                    return `${rootPrefix(node.parentNode)}\0\0EMPTY-MARKER\0`;
                }

                case TC.EntityKind.BrokenFavorite: {
                    return `${rootPrefix(node.parentNode)}\0\0BROKEN-MARKER\0${node.ref.scopeName}\0${node.ref.label}`;
                }

                case TC.EntityKind.Group: {
                    const { root, segments } = walkToRoot(node);
                    segments.push(rootPrefix(root));
                    return segments.join('\0');
                }

                case TC.EntityKind.RunnableGroup:
                case TC.EntityKind.Runnable: {
                    const root = getRootGroup(node);
                    return `${rootPrefix(root)}task://${node.entity.id}`;
                }

                // #region DEBUG
                default: {
                    const _node: never = node;
                    assert(false, `${_node}`); // @todo
                    return '(ERROR)';
                }
                // #endregion DEBUG
            }
        },
        */

    } as const,

} as const;


function childFrom(
    item: Section.Item,
    parentNode: ParentNode
): HierarchyChild {
    if (Section.Child.isRunnable(item)) {
        if (Section.Child.isGroup(item)) {
            return { kind: TC.EntityKind.RunnableGroup, parentNode: parentNode, entity: item } as RunnableGroup;
        }
        return { kind: TC.EntityKind.Runnable, parentNode: parentNode, entity: item } as Runnable;
    }
    return { kind: TC.EntityKind.Group, parentNode: parentNode, entity: item } as Group;
}



function getRootGroup(node: HierarchyChild): PinnedFolder | PinnedSingle | FolderRoot | WorkspaceRoot {
    let parent = node.parentNode;
    while (true) {
        switch (parent.kind) {

            case TC.EntityKind.Group:
            case TC.EntityKind.RunnableGroup: {
                parent = parent.parentNode;
                continue;
            }

            case TC.EntityKind.Folder:
            case TC.EntityKind.Workspace:
            case TC.EntityKind.PinnedSingle:
            case TC.EntityKind.PinnedFolder: {
                return parent;
            }

            // #region DEBUG
            default: {
                const _parent: never = parent;
                assert(false, `${_parent}`); // @todo
            }
            // #endregion DEBUG
        }
    }
}


function walkToRoot(node: HierarchyChild): {
    root: PinnedFolder | PinnedSingle | FolderRoot | WorkspaceRoot;
    segments: string[];
} {
    const segments: string[] = [];
    let parent = node.parentNode;
    while (true) {
        switch (parent.kind) {
            case TC.EntityKind.Group:
            case TC.EntityKind.RunnableGroup: {
                segments.push(Hierarchy.Node.getSegment(parent.entity));
                parent = parent.parentNode;
                continue;
            }
            case TC.EntityKind.Folder:
            case TC.EntityKind.Workspace:
            case TC.EntityKind.PinnedSingle:
            case TC.EntityKind.PinnedFolder: {
                return { root: parent, segments: segments.reverse() };
            }

            // #region DEBUG
            default: {
                const _parent: never = parent;
                assert(false, `${_parent}`);
            }
            // #endregion DEBUG
        }
    }
}


function rootPrefix(root: PinnedFolder | PinnedSingle | PinnedMulti | FolderRoot | WorkspaceRoot): string {
    switch (root.kind) {
        case TC.EntityKind.PinnedMulti:
        case TC.EntityKind.PinnedSingle: {
            return '\0\0favorites://';
        }

        case TC.EntityKind.PinnedFolder: {
            return `\0\0favorites://\0${root.tasksFile}\0//`;
        }

        case TC.EntityKind.Folder:
        case TC.EntityKind.Workspace: {
            return `\0\0${root.tasksFile}//`;
        }

        // #region DEBUG
        default: {
            const _root: never = root;
            assert(false, `${_root}`);
            return 'ERROR';
        }
        // #endregion DEBUG
    }
}

export default TreeModel;