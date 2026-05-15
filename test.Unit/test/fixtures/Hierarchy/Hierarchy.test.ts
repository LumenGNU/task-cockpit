import * as assert from 'assert/strict';
import Hierarchy from '../../../src/Cockpit/TreeModel/Hierarchy';

// `${/*N=0*/'000'/**/}`

suite('Cockpit', function () {

    suite('TreeModel', function () {

        suite('Hierarchy', function () {

            suite('API surface', function () {

                test(`${/*++N*/'001'/**/} all public methods work when destructured (no this-dependency)`, function () {

                    const {
                        build,
                        getRoots,
                        lookup,
                        walk,
                        Node,
                    } = Hierarchy;

                    const {
                        isData,
                        isBranch,
                        getSegment,
                        getData,
                        getParent,
                        getBranchChildren,
                        resolvePath,
                        walk: nodeWalk,
                    } = Node;

                    const hierarchy = build([
                        { path: ['a', 'b', 'c'], data: { tag: 'leaf' } },
                        { path: ['a', 'b'], data: { tag: 'mid' } },
                        { path: ['a'], data: { tag: 'root' } },
                    ]);

                    const roots = getRoots(hierarchy);
                    assert.strictEqual(roots.length, 1, 'getRoots');

                    const nodeA = roots[0]!;
                    assert.ok(isBranch(nodeA), 'isBranch');
                    assert.ok(isData(nodeA), 'isData');
                    assert.strictEqual(getSegment(nodeA), 'a', 'getSegment');
                    assert.strictEqual(getData(nodeA).tag, 'root', 'getData');
                    assert.strictEqual(getParent(nodeA), null, 'getParent on root');
                    assert.deepStrictEqual(resolvePath(nodeA), ['a'], 'resolvePath');

                    const nodeB = getBranchChildren(nodeA)[0]!;
                    assert.ok(isBranch(nodeB), 'isBranch on mid');
                    assert.ok(isData(nodeB), 'isData on mid');
                    assert.strictEqual(getParent(nodeB), nodeA, 'getParent');

                    const found = lookup(hierarchy, ['a', 'b', 'c']);
                    assert.ok(found, 'lookup');
                    assert.ok(isData(found), 'isData on lookup result');
                    assert.strictEqual(getData(found).tag, 'leaf', 'getData on lookup result');

                    const walkedByHierarchy: string[] = [];
                    walk(hierarchy, node => walkedByHierarchy.push(getSegment(node)));
                    assert.strictEqual(walkedByHierarchy.length, 3, 'walk (hierarchy)');

                    const walkedByNode: string[] = [];
                    nodeWalk(nodeA, node => walkedByNode.push(getSegment(node)));
                    assert.strictEqual(walkedByNode.length, 3, 'walk (node)');
                    assert.strictEqual(walkedByNode[0], 'a', 'nodeWalk starts with root');
                });

            });

        });
    });
});