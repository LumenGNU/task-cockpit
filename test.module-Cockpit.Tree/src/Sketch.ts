import { z } from 'zod';
import * as TC from './types';
import helpers from './helpers';

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
    name: z.string().min(1, 'name обязателен').transform(v => v as TC.Name),
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
    pinned: z.array(z.string().min(1).transform(v => v as TC.Name)).prefault([]),
}).strict();

const pinnedStaleSchema = z.object({
    scopeName: z.string().min(1),
    label: z.string().min(1),
}).strict();

const pinnedConfigSchema = z.object({
    visibility: z.enum(['AUTO', 'HIDE']).prefault('AUTO')
        .transform(v => v === 'AUTO' ? TC.PinnedVisibility.AUTO : TC.PinnedVisibility.HIDE),
    compressionBehavior: z.enum(['NORMAL', 'SMART']).prefault('NORMAL')
        .transform(v => v === 'NORMAL' ? TC.CompressionBehavior.NORMAL : TC.CompressionBehavior.SMART),
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
    sketch: bodySchema,
    asciiTree: z.array(z.string()).prefault([]),
}).strict();

export type Sketch = z.infer<typeof sketchSchema>;
type Body = z.infer<typeof bodySchema>;


// ============================================================
// Loader
// ============================================================

export interface LoadResult {
    readonly title: string;
    readonly asciiTree: string;
    readonly treeInput: TC.TreeInput;
}

export function load(data: unknown): LoadResult {
    const parsed = sketchSchema.safeParse(data);
    if (!parsed.success) {
        throw new Error(`Sketch validation failed:\n${z.prettifyError(parsed.error)}`);
    }

    const { title, sketch, asciiTree } = parsed.data;

    return {
        title,
        asciiTree: asciiTree.map(s => s.trimEnd()).join('\n'),
        treeInput: buildTreeInput(sketch),
    };
}

function buildTreeInput(sketch: Body): TC.TreeInput {
    // Глобальные конфиги, раздаются по ссылке каждому scope.
    const treeConfig: TC.TreeConfig = Object.freeze({ ...sketch.treeConfig });
    const nodeConfig: TC.NodeConfig = Object.freeze({ ...sketch.nodeConfig });

    const scopeIndex = new Map<TC.File, TC.ScopeRecord>();

    for (const [folderNameRaw, entry] of Object.entries(sketch.scopes)) {
        const folderName = folderNameRaw as TC.FolderName;
        const file = entry.tasksFile as TC.File;

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
        });
    }

    return {
        scopeIndex,
        pinnedConfig: {
            visibility: sketch.pinned.visibility,
            compressionBehavior: sketch.pinned.compressionBehavior,
            staleRecords: sketch.pinned.stales,
        },
        excludedFolders: new Set(sketch.excludeFolders),
    };
}


