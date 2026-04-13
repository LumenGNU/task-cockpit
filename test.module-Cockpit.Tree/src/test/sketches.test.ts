import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import { readdirSync, readFileSync } from 'fs';
import { parse as parseJSONC, ParseError } from 'jsonc-parser';
import * as Sketch from '../Sketch';
import TreeModel from '../Cockpit/TreeModel';
import * as TC from '../types';

const SKETCHES_DIR = 'src/test/sketches';

function resolveSketches(dir: string): { sketchDir: string, sketchFile: string; }[] {
    const sketchDir = `${SKETCHES_DIR}/${dir}`;
    return readdirSync(sketchDir)
        .filter(f => !f.startsWith('~'))
        .filter(f => f.endsWith('.jsonc'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((sketchFile) => ({
            sketchDir,
            sketchFile
        }))
        ;
}

suite('Sketches', () => {

    [
        ['Structural Testing', 'structural-testing', simpleLabelFormatter] as const,
        ['Appearance Testing (description flags)', 'appearance-testing/description-flags', descriptionFormatter] as const,
        ['Appearance Testing (icon and color)', 'appearance-testing/icon-and-color', iconFormatter] as const,
        ['Stress Tests', 'stress', simpleLabelFormatter] as const,

    ].forEach(([suiteTitle, folder, formatter]) => {

        suite(suiteTitle, () => {

            for (const { sketchDir, sketchFile } of resolveSketches(folder)) {

                const errors: ParseError[] = [];

                const raw = readFileSync(`${sketchDir}/${sketchFile}`, 'utf-8');

                const jsonc = parseJSONC(
                    Buffer.from(raw)
                        .toString('utf-8'),
                    errors,
                    {
                        allowEmptyContent: true,
                        allowTrailingComma: true,
                        disallowComments: false
                    }
                );

                if (errors.length > 0) {
                    throw new Error(`JSONC Parse Error:\n${errors.join('\n')}`);
                }

                let sketch;
                try {
                    sketch = Sketch.load(jsonc);
                }
                catch (error) {
                    assert.fail(`${sketchFile}:\n${(error as Error).message}`);
                }

                const { title, treeInput, asciiTree } = sketch;

                test(`${title}: (${sketchFile})`, () => {
                    const { sections } = TreeModel.build(treeInput);
                    const actualAsciiTree = TreeModel.printTree(sections, formatter);
                    assert.strictEqual(asciiTree, actualAsciiTree);
                });
            }

        });

    });

});


//
function simpleLabelFormatter(node: TreeModel.Node) {

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
};


function descriptionFormatter(node: TreeModel.Node) {

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
}


function iconFormatter(node: TreeModel.Node) {

    const { label, iconPath } = TreeModel.describe(node);

    function fmtIcon(icon: vscode.IconPath | undefined): string {
        if (icon instanceof vscode.ThemeIcon) {
            const color = icon.color ? `~${icon.color.id}` : '';
            return `$(${icon.id}${color})`;
        }
        return '';
    }


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
}