import { z } from 'zod';
import * as TC from './types';
import * as vscode from 'vscode';
import helpers from './helpers';

// --- Атомарные куски ---

const iconSchema = z
    .object({
        id: z.string().optional(),
        color: z.string().optional(),
    })
    .strict()
    .optional()
    .default({});

const groupSchema = z
    .object({
        kind: z.enum(['Build', 'Test', 'Clean'] as const).transform((v) => v as TC.Group),
        isDefault: z.boolean().default(false),
    })
    .strict();

const taskSchema = z
    .object({
        name: z.string().min(1, "name обязателен").transform((v) => v as TC.Name),
        hidden: z.boolean().optional().default(false),
        icon: iconSchema,
        rejectFlag: z.boolean().optional().default(false),
        isBackground: z.boolean().optional().default(false),
        group: groupSchema.optional(),
    })
    .strict();


const bodySchema = z.object({
    scopes: z.record(
        z.string().min(1).transform((v) => v as TC.FolderName),
        z.string()
            .regex(
                /\.vscode\/tasks\.json$|\.code-workspace$/,
                "значение должно заканчиваться на .vscode/tasks.json или .code-workspace"
            )
            .transform((u) => vscode.Uri.file(u) as TC.Uri)
    )
        .refine(
            (scopes) => Object.keys(scopes).length > 0,
            "scopes обязателен и не может быть пустым"
        )
        .refine(
            (scopes) => {
                const values = Object.values(scopes);
                return new Set(values).size === values.length;
            },
            "значения в scopes должны быть уникальными"
        ),

    tasks: z.record(z.string().min(1), z.array(taskSchema)),

    pinned: z
        .object({
            visibility: z.enum(['AUTO', 'HIDE'] as const)
                .default('AUTO')
                .transform((v) => v === 'AUTO' ? TC.PinnedVisibility.AUTO : TC.PinnedVisibility.HIDE),
            compressionBehavior: z.enum(['NORMAL', 'SMART'] as const)
                .default('NORMAL')
                .transform((v) => v === 'NORMAL' ? TC.CompressionBehavior.NORMAL : TC.CompressionBehavior.SMART),
            refs: z.array(
                z.object({
                    scope: z.string().min(1).transform((v) => v as TC.FolderName),
                    label: z.string().min(1).transform((v) => v as TC.Name),
                })
                    .strict()
            )
                .optional()
                .default([]),
            stales: z.array(
                z.object({
                    scopeName: z.string().min(1),
                    label: z.string().min(1),
                })
                    .strict()
            )
                .optional()
                .default([]),
        })
        .strict()
        .optional()
        .default({
            visibility: TC.PinnedVisibility.AUTO,
            compressionBehavior: TC.CompressionBehavior.NORMAL,
            refs: [],
            stales: []
        }),

    treeConfig: z
        .object({
            segmentSeparator: z.union([z.string(), z.literal(false)]).default(false),
            useGroupKind: z.boolean().default(false),
            showHidden: z.boolean().default(false),
        })
        .strict()
        .optional()
        .default({
            segmentSeparator: false,
            useGroupKind: false,
            showHidden: false,
        }),

    nodeConfig: z
        .object({
            useFolderIcon: z.boolean().default(false),
            defaultIconName: z.string().default("tools"),
            tintLabel: z.boolean().default(false),
        })
        .strict()
        .optional()
        .default({
            useFolderIcon: false,
            defaultIconName: "tools",
            tintLabel: false,
        }),

    excludeFolders: z.array(z.string().transform(v => v as TC.FolderName)).optional().default([]),
})
    .strict()
    .superRefine((data, ctx) => {
        const scopeKeys = Object.keys(data.scopes).sort();
        const taskKeys = Object.keys(data.tasks).sort();

        if (JSON.stringify(scopeKeys) !== JSON.stringify(taskKeys)) {
            ctx.addIssue({
                code: 'custom',
                message: "Ключи в tasks должны точно соответствовать ключам в scopes",
                path: ["tasks"],
            });
        }

        data.pinned.refs.forEach((ref, i) => {
            // scope существует?
            if (!scopeKeys.includes(ref.scope)) {
                ctx.addIssue({
                    code: 'custom',
                    message: `scope "${ref.scope}" в pinned.refs не найден в scopes`,
                    path: ["pinned", "refs", i, "scope"],
                });
                return; // нет scope — label проверять бессмысленно
            }

            // label существует среди задач этого scope?
            const tasks = data.tasks[ref.scope];
            if (!tasks?.some(t => t.name === ref.label)) {
                ctx.addIssue({
                    code: 'custom',
                    message: `label "${ref.label}" не найден среди задач scope "${ref.scope}"`,
                    path: ["pinned", "refs", i, "label"],
                });
            }
        });
    });


//------------------
export const sketchSchema = z
    .object({
        title: z.string().min(1, "title обязателен"),
        sketch: bodySchema,
        asciiTree: z.array(z.string()).optional().default([]),
    })
    .strict();

// ------------------
export type Sketch = z.infer<typeof sketchSchema>;


export function load(data: unknown): {
    title: string,
    asciiTree: string,
    data: {
        scopes: ReadonlyArray<TC.Scope>,
        definitionMap: Readonly<TC.DefinitionsByFile>,
        treeConfigMap: Readonly<TC.TreeConfigByFile>,
        nodeConfigMap: Readonly<TC.NodeConfigByFile>,
        pinnedConfig: Readonly<TC.PinnedConfig>,
        excludeFolders: ReadonlySet<TC.FolderName>;
    };
} {

    const result = sketchSchema.safeParse(data);

    if (!result.success) {
        console.error(z.prettifyError(result.error));
        throw new Error();
    }

    const scopesMap = new Map<TC.FolderName, TC.Scope>();

    const definitionMap: TC.DefinitionsByFile = new Map();
    const treeConfigMap: TC.TreeConfigByFile = new Map();
    const nodeConfigMap: TC.NodeConfigByFile = new Map();

    for (const [scopeName, uri] of Object.entries(result.data.sketch.scopes)) {

        const folderName = scopeName as TC.FolderName;
        scopesMap.set(folderName, {
            name: folderName,
            uri
        });

        const file = uri.fsPath;
        const defs = result.data.sketch.tasks[scopeName];
        const scopedDefinitions: TC.ScopedDefinitions = new Map();

        for (const def of defs) {
            const { name, ...fields } = def;
            const taskDefinition: TC.TaskDefinition = {
                id: helpers.buildId(file, name),
                ...fields
            };
            scopedDefinitions.set(name, taskDefinition);
        }

        definitionMap.set(file, scopedDefinitions);
        treeConfigMap.set(file, result.data.sketch.treeConfig);
        nodeConfigMap.set(file, result.data.sketch.nodeConfig);

    }

    const pinnedConfig: TC.PinnedConfig = {
        visibility: result.data.sketch.pinned.visibility,
        compressionBehavior: result.data.sketch.pinned.compressionBehavior,
        pinnedRecords: result.data.sketch.pinned.refs.map((f) => {
            const scope = scopesMap.get(f.scope)!;
            return { scope, label: f.label };
        }),
        staleRecords: result.data.sketch.pinned.stales
    };

    // console.log([...definitionMap.values()].flatMap(m => [...m.keys()]));

    return {
        title: result.data.title,
        asciiTree: result.data.asciiTree.map((s) => s.trimEnd()).join('\n'),
        data: {
            scopes: [...scopesMap.values()],
            definitionMap,
            treeConfigMap,
            nodeConfigMap,
            pinnedConfig,
            excludeFolders: new Set(result.data.sketch.excludeFolders)
        }
    };

}
