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
        ['Structural Testing', 'structural-testing'] as const,
        ['Appearance Testing (description flags)', 'appearance-testing/description-flags'] as const,
        ['Appearance Testing (icon and color)', 'appearance-testing/icon-and-color'] as const,
        ['Stress Tests', 'stress'] as const,

    ].forEach(([suiteTitle, folder]) => {

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

                const { title, treeInput, expectedRender } = sketch;

                test(`${title}: (${sketchFile})`, () => {
                    const { sections } = TreeModel.build(treeInput);
                    const actualSnapshot = TreeModel.printTree(sections, Sketch.formatter[expectedRender.formatter]);
                    assert.strictEqual(expectedRender.snapshot, actualSnapshot);
                });
            }

        });

    });

});








