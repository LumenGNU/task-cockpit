import * as assert from 'assert/strict';
import Hierarchy from '../../../src/Cockpit/TreeModel/Hierarchy';

// `${/*N=0*/'000'/**/}`

suite('Cockpit', function () {

    suite('TreeModel', function () {

        suite('Hierarchy', function () {

            suite('Node', () => {

                suite('walk', () => {

                    // Обходит поддерево branch-узла (pre-order), включая сам узел.
                    test(`${/*++N*/'001'/**/} visits subtree in pre-order including the node itself`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['root', 'a', 'deep'], data: { tag: '1' } },
                            { path: ['root', 'b'], data: { tag: '2' } },
                            { path: ['root'], data: { tag: '0' } },
                            { path: ['outside'], data: { tag: 'x' } },
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);


                        const rootNode = roots.at(0);
                        assert.ok(rootNode, 'precondition');
                        assert.ok(Hierarchy.Node.isBranch(rootNode), 'precondition');
                        assert.strictEqual(Hierarchy.Node.getSegment(rootNode), 'root', 'precondition');

                        const segments: string[] = [];

                        Hierarchy.Node.walk(rootNode, (node) => {
                            segments.push(Hierarchy.Node.getSegment(node));
                        });

                        // root, a, deep, b — 4 узла; outside не входит
                        assert.strictEqual(segments.length, 4,
                            `must visit 4 nodes, got: [${segments}]`);
                        assert.ok(!segments.includes('outside'), 'must not visit outside subtree');
                        assert.strictEqual(segments[0], 'root', 'must start with the node itself');
                        // pre-order: a перед deep
                        assert.ok(segments.indexOf('a') < segments.indexOf('deep'));
                    });
                });
            });
        });
    });
});