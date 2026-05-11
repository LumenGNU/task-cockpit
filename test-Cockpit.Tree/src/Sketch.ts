// @todo каждая скопа со своими настройками
import { z } from 'zod';
import * as TC from './types';
import helpers from './helpers';
import TreeModel from './Cockpit/TreeModel';
import * as vscode from 'vscode';

const formatterNames = ['simple', 'icon', 'description'] as const;

// ============================================================
// Schemas — атомы
// ============================================================

const iconSchema = z.object({
    id: z.string().optional(),
    color: z.string().optional(),
}).strict();

const groupSchema = z.object({
    kind: z.enum(['Build', 'Test', 'Clean']).transform(v => v as TC.Group),
    isDefault: z.boolean().prefault(false),
}).strict();

const taskSchema = z.object({
    name: z.string().min(1, 'name обязателен').transform(v => v as TC.TaskName),
    hidden: z.boolean().prefault(false),
    icon: iconSchema.prefault({}),
    rejectFlag: z.boolean().prefault(false),
    isBackground: z.boolean().prefault(false),
    group: groupSchema.optional(),
}).strict();

const scopeEntrySchema = z.object({
    tasksFile: z.string()
        .min(1)
        .regex(
            /\.vscode\/tasks\.json$|\.code-workspace$/,
            'путь должен заканчиваться на .vscode/tasks.json или .code-workspace',
        ),
    tasks: z.array(taskSchema),
    pinned: z.array(z.string().min(1).transform(v => v as TC.TaskName)).prefault([]),
}).strict();

const pinnedStaleSchema = z.object({
    scopeName: z.string().min(1),
    label: z.string().min(1),
}).strict();

const pinnedConfigSchema = z.object({
    visibility: z.enum(['AUTO', 'HIDE']).prefault('AUTO')
        .transform(v => v === 'AUTO' ? true : false),
    compressionBehavior: z.enum(['NORMAL', 'SMART']).prefault('NORMAL')
        .transform(v => v === 'NORMAL' ? false : true),
    stales: z.array(pinnedStaleSchema).prefault([]),
}).strict();

const treeConfigSchema = z.object({
    segmentSeparator: z.union([z.string(), z.literal(false)]).prefault(false),
    useGroupKind: z.boolean().prefault(false),
    showHidden: z.boolean().prefault(false),
}).strict();

const nodeConfigSchema = z.object({
    useFolderIcon: z.boolean().prefault(false),
    defaultIconName: z.string().prefault('tools'),
    tintLabel: z.boolean().prefault(false),
}).strict();

const formatterNameSchema = z.enum(formatterNames);
export type FormatterName = z.infer<typeof formatterNameSchema>;

const expectedRenderSchema = z.object({
    formatter: formatterNameSchema,
    snapshot: z.array(z.string()),
}).strict();


// ============================================================
// Schema — корпус и superRefine
// ============================================================

const bodySchema = z.object({
    scopes: z.record(
        z.string().min(1).transform(v => v as TC.FolderName),
        scopeEntrySchema,
    ).refine(s => Object.keys(s).length > 0, 'scopes не может быть пустым'),
    pinned: pinnedConfigSchema.prefault({}),
    treeConfig: treeConfigSchema.prefault({}),
    nodeConfig: nodeConfigSchema.prefault({}),
    excludeFolders: z.array(z.string().transform(v => v as TC.FolderName)).prefault([]),
}).strict().superRefine((data, ctx) => {
    // 1. Уникальность fsPath между scopes
    const pathToScope = new Map<string, string>();
    for (const [scopeName, entry] of Object.entries(data.scopes)) {
        const path = entry.tasksFile;
        const owner = pathToScope.get(path);
        if (owner !== undefined) {
            ctx.addIssue({
                code: 'custom',
                message: `путь "${path}" уже используется в scope "${owner}"`,
                path: ['scopes', scopeName, 'tasksFile'],
            });
        } else {
            pathToScope.set(path, scopeName);
        }
    }

    // 2. Per-scope валидация: уникальность имён задач + согласованность pinned
    for (const [scopeName, entry] of Object.entries(data.scopes)) {
        // 2a. Дубликаты имён задач
        const taskNames = new Map<string, number>();
        entry.tasks.forEach((t, i) => {
            const prev = taskNames.get(t.name);
            if (prev !== undefined) {
                ctx.addIssue({
                    code: 'custom',
                    message: `имя задачи "${t.name}" дублируется в scope "${scopeName}" (первое — индекс ${prev})`,
                    path: ['scopes', scopeName, 'tasks', i, 'name'],
                });
            } else {
                taskNames.set(t.name, i);
            }
        });

        // 2b. Pinned: дубли + существование
        const pinnedSeen = new Set<string>();
        entry.pinned.forEach((label, i) => {
            if (pinnedSeen.has(label)) {
                ctx.addIssue({
                    code: 'custom',
                    message: `дубликат "${label}" в pinned scope "${scopeName}"`,
                    path: ['scopes', scopeName, 'pinned', i],
                });
                return;
            }
            pinnedSeen.add(label);

            if (!taskNames.has(label)) {
                ctx.addIssue({
                    code: 'custom',
                    message: `задача "${label}" не найдена в scope "${scopeName}"`,
                    path: ['scopes', scopeName, 'pinned', i],
                });
            }
        });
    }
});

export const sketchSchema = z.object({
    title: z.string().min(1, 'title обязателен'),
    expectedRender: expectedRenderSchema,
    sketch: bodySchema,
}).strict();

export type Sketch = z.infer<typeof sketchSchema>;
type Body = z.infer<typeof bodySchema>;


// ============================================================
// Loader
// ============================================================

export interface ExpectedRender {
    readonly formatter: FormatterName;
    readonly snapshot: string;
}

export interface LoadResult {
    readonly title: string;
    readonly expectedRender: ExpectedRender;
    readonly treeInput: TC.TreeInput;
}

export function load(data: unknown): LoadResult {
    const parsed = sketchSchema.safeParse(data);
    if (!parsed.success) {
        throw new Error(`Sketch validation failed:\n${z.prettifyError(parsed.error)}`);
    }

    const { title, sketch, expectedRender } = parsed.data;

    return {
        title,
        expectedRender: {
            formatter: expectedRender.formatter,
            snapshot: expectedRender.snapshot.map(s => s.trimEnd()).join('\n'),
        },
        treeInput: buildTreeInput(sketch),
    };
}

function buildTreeInput(sketch: Body): TC.TreeInput {
    // Глобальные конфиги, раздаются по ссылке каждому scope.
    const treeConfig: TC.TreeConfig = Object.freeze({ ...sketch.treeConfig });
    const nodeConfig: TC.NodeConfig = Object.freeze({ ...sketch.nodeConfig });

    const scopeIndex = new Map<TC.ScopeFile, TC.ScopeRecord>();

    for (const [folderNameRaw, entry] of Object.entries(sketch.scopes)) {
        const folderName = folderNameRaw as TC.FolderName;
        const file = entry.tasksFile as TC.ScopeFile;

        const definitionMap: TC.ScopedDefinitions = new Map();
        for (const def of entry.tasks) {
            const { name, ...rest } = def;
            definitionMap.set(name, {
                id: helpers.buildId(file, name),
                ...rest,
            });
        }

        scopeIndex.set(file, {
            folderName,
            definitionMap,
            treeConfig,
            nodeConfig,
            pinned: new Set(entry.pinned),
            excluded: sketch.excludeFolders.includes(folderName)
        });
    }

    return {
        scopeIndex,
        pinnedConfig: {
            visibility: sketch.pinned.visibility,
            smartPathCompression: sketch.pinned.compressionBehavior,
        },
        pinnedStales: sketch.pinned.stales,
    };
}


// Формирует ASCII дерево. Вызывает formatter на каждом узле.
export function printTree(
    roots: ReadonlyArray<Readonly<TreeModel.TopRoot>>,
    formatter: (node: TreeModel.Node) => string
): string {

    const lines: string[] = [];

    const walk = (node: TreeModel.Node, prefix: string, isLast: boolean, isRoot: boolean): void => {

        const connector = isRoot ? '━' : isLast ? '└─ ' : '├─ ';
        lines.push(prefix + connector + formatter(node));

        const children = TreeModel.getChildren(node);
        if (!children) return;

        const childPrefix = isRoot ? '  ' : prefix + (isLast ? '   ' : '│  ');

        for (let i = 0; i < children.length; i++) {
            walk(children[i]!, childPrefix, i === children.length - 1, false);
        }
    };

    for (let i = 0; i < roots.length; i++) {
        if (i > 0) lines.push('');
        walk(roots[i]!, '', true, true);
    }

    return lines.join('\n');
}

type NodeFormatter = (node: TreeModel.Node) => string;

type FormatterNameType = typeof formatterNames[number];

export const formatter: Record<FormatterNameType, NodeFormatter> = {
    // ---
    simple: (node) => {
        const {
            label,
            // collapsibleState,
            // description,
            // iconPath,
            // id
        } = TreeModel.describe(node);

        switch (node.kind) {
            case TC.EntityKind.Folder: {
                return `[F[ ${label} ]]`;
            }

            case TC.EntityKind.Workspace: {
                return `[W[ ${label} ]]`;
            }

            case TC.EntityKind.PinnedStaleOnly:
            case TC.EntityKind.PinnedSingle:
            case TC.EntityKind.PinnedMulti: {
                return `[★[ ${label} ]]`;
            }

            case TC.EntityKind.PinnedFolder: {
                return `[ ${label} ]`;
            }

            case TC.EntityKind.BrokenPinned: {
                return `« ✗ ${label} »`;
            }

            case TC.EntityKind.Empty: {
                return `« ${label} »`;
            }

            case TC.EntityKind.Group: {
                return label;
            }

            case TC.EntityKind.Runnable:
            case TC.EntityKind.RunnableGroup: {
                return `▶ ${label}`;
            }

            default: {
                const _node: never = node;
                return '== ERROR ==';
            }
        }
    },

    // ---
    icon: (node) => {
        const { label, iconPath } = TreeModel.describe(node);

        function fmtIcon(icon: vscode.IconPath | undefined): string {
            if (icon instanceof vscode.ThemeIcon) {
                const color = icon.color ? `~${icon.color.id}` : '';
                return `$(${icon.id}${color})`;
            }
            return '$(-no-icon-)';
        }


        switch (node.kind) {
            case TC.EntityKind.Folder: {
                return `[F[ ${label} ]] · ${fmtIcon(iconPath)}`;
            }

            case TC.EntityKind.Workspace: {
                return `[W[ ${label} ]] · ${fmtIcon(iconPath)}`;
            }

            case TC.EntityKind.PinnedStaleOnly:
            case TC.EntityKind.PinnedSingle:
            case TC.EntityKind.PinnedMulti: {
                return `[★[ ${label} ]] · ${fmtIcon(iconPath)}`;
            }

            case TC.EntityKind.PinnedFolder: {
                return `[ ${label} ] · ${fmtIcon(iconPath)}`;
            }

            case TC.EntityKind.BrokenPinned: {
                return `« ✗ ${label} » · ${fmtIcon(iconPath)}`;
            }

            case TC.EntityKind.Empty: {
                return `« ${label} » · ${fmtIcon(iconPath)}`;
            }

            case TC.EntityKind.Group: {
                return `${label} · ${fmtIcon(iconPath)}`;
            }

            case TC.EntityKind.Runnable:
            case TC.EntityKind.RunnableGroup: {
                return `▶ ${label} · ${fmtIcon(iconPath)}`;
            }

            default: {
                const _node: never = node;
                return '== ERROR ==';
            }
        }
    },

    // ---
    description: (node) => {
        const { label, description } = TreeModel.describe(node);

        const withDesc = (text: string) =>
            description ? `${text} · ${description}` : text;

        switch (node.kind) {
            case TC.EntityKind.Folder: {
                return `[F[ ${label} ]]`;
            }

            case TC.EntityKind.Workspace: {
                return `[W[ ${label} ]]`;
            }

            case TC.EntityKind.PinnedStaleOnly:
            case TC.EntityKind.PinnedSingle:
            case TC.EntityKind.PinnedMulti: {
                return `[★[ ${label} ]]`;
            }

            case TC.EntityKind.PinnedFolder: {
                return `[ ${label} ]`;
            }

            case TC.EntityKind.BrokenPinned: {
                return `« ✗ ${label} »`;
            }

            case TC.EntityKind.Empty: {
                return `« ${label} »`;
            }

            case TC.EntityKind.Group: {
                return withDesc(label);
            }

            case TC.EntityKind.Runnable:
            case TC.EntityKind.RunnableGroup: {
                return withDesc(`▶ ${label}`);
            }

            default: {
                const _node: never = node;
                return '== ERROR ==';
            }
        }
    },
};