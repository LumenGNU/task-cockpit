import * as assert from 'assert/strict';
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

                const { title, data, asciiTree } = sketch;

                test(`${title}: (${sketchFile})`, () => {
                    const topRoots = TreeModel.build(data);
                    const actualAsciiTree = TreeModel.printTree(topRoots, formatter);
                    assert.strictEqual(asciiTree, actualAsciiTree);
                });
            }

        });

    });

});


//
function simpleLabelFormatter(node: TreeModel.Node) {

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
            return TreeModel.Accessors.getLabel(node);
        }

        case TC.EntityKind.Runnable:
        case TC.EntityKind.RunnableGroup: {
            return `▶ ${TreeModel.Accessors.getLabel(node)}`;
        }

        default: {
            const _node: never = node;
            return '== ERROR ==';
        }
    }
};