import * as assert from 'assert/strict';
import Hierarchy from 'src/TreeModel/Hierarchy';

// `${/*N=0*/'000'/**/}`

suite('Cockpit', function () {

    suite('TreeModel', function () {

        suite('Hierarchy', function () {

            suite('Node', function () {

                suite('getParent', function () {


                    test(`${/*++N*/'001'/**/} корневой узел → parent — это null`, function () {
                        const hierarchy = Hierarchy.build([
                            { path: ['a', 'b'], data: { tag: 'x' } },
                        ]);
                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots.length > 0);
                        const rootNode = roots.at(0);
                        assert.ok(rootNode);
                        const parent = Hierarchy.Node.getParent(rootNode);
                        assert.strictEqual(parent, null, 'parent of root node must be null');
                    });


                    test(`${/*++N*/'002'/**/} лист возвращает своего непосредственного родителя`, function () {
                        const hierarchy = Hierarchy.build([
                            { path: ['a', 'b'], data: { tag: 'leaf' } },
                        ]);
                        const parent = Hierarchy.getRoots(hierarchy).at(0);
                        assert.ok(parent, 'precondition');
                        assert.ok(Hierarchy.Node.isBranch(parent));
                        const leaf = Hierarchy.Node.getBranchChildren(parent).at(0);
                        assert.ok(leaf, 'precondition');
                        assert.ok(Hierarchy.Node.isData(leaf));
                        assert.strictEqual(Hierarchy.Node.getParent(leaf), parent);
                    });


                    test(`${/*++N*/'003'/**/} промежуточный узел возвращает своего родителя`, function () {
                        const hierarchy = Hierarchy.build([
                            { path: ['a', 'b', 'c'], data: { tag: 'deep' } },
                        ]);
                        const nodeA = Hierarchy.getRoots(hierarchy).at(0);
                        assert.ok(nodeA, 'precondition');
                        assert.ok(Hierarchy.Node.isBranch(nodeA));
                        const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                        assert.ok(nodeB, 'precondition');
                        assert.ok(Hierarchy.Node.isBranch(nodeB));
                        assert.strictEqual(Hierarchy.Node.getParent(nodeB), nodeA);
                    });

                });


            });

        });
    });
});
