import * as assert from 'assert/strict';
import { readdirSync, readFileSync } from 'fs';
import { parse as parseJSONC, ParseError } from 'jsonc-parser';
import * as Sketch from '../Sketch';
import TreeModel from '../Cockpit/TreeModel';


const SKETCHES_DIR = 'src/test/sketches';

type SuiteNode = Map<string, SuiteNode>;

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


function collectSketchDirs(baseDir: string): string[] {
    const results: string[] = [];

    function walk(dir: string, relativePath: string): void {
        const entries = readdirSync(dir, { withFileTypes: true });
        const hasJsonc = entries.some(e => e.isFile() && e.name.endsWith('.jsonc') && !e.name.startsWith('~'));
        if (hasJsonc) results.push(relativePath);
        for (const entry of entries) {
            if (entry.isDirectory()) {
                walk(
                    `${dir}/${entry.name}`,
                    relativePath ? `${relativePath}/${entry.name}` : entry.name
                );
            }
        }
    }

    walk(baseDir, '');
    return results;
}


function toTitle(segment: string): string {
    return segment.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}


function registerSuiteTree(node: SuiteNode, basePath: string): void {
    for (const [segment, children] of node) {
        const fullPath = basePath ? `${basePath}/${segment}` : segment;
        suite(toTitle(segment), () => {
            resolveSketches(fullPath).forEach(makeTest);  // всегда
            if (children.size > 0) {
                registerSuiteTree(children, fullPath);    // + рекурсия если нужно
            }
        });
    }
}


function insertPath(root: SuiteNode, parts: string[]): void {
    let node = root;
    for (const part of parts) {
        if (!node.has(part)) node.set(part, new Map());
        node = node.get(part)!;
    }
}


suite('Sketches', () => {
    const root: SuiteNode = new Map();
    for (const dir of collectSketchDirs(SKETCHES_DIR)) {
        insertPath(root, dir.split('/'));
    }
    registerSuiteTree(root, '');
});

export function makeTest({ sketchDir, sketchFile }: { sketchDir: string, sketchFile: string; }) {

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

    test(`${title}: (${sketchFile})`, function () {
        const { sections } = TreeModel.build(treeInput);
        const actualSnapshot = Sketch.printTree(sections, Sketch.formatter[expectedRender.formatter]);
        assert.strictEqual(expectedRender.snapshot, actualSnapshot, 'Snapshots don\'t match');
    });
}