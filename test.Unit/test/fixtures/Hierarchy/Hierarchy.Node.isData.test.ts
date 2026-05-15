import * as assert from 'assert/strict';
import Hierarchy from '../../../src/Cockpit/TreeModel/Hierarchy';

// `${/*N=0*/'000'/**/}`

suite('Cockpit', function () {

    suite('TreeModel', function () {

        suite('Hierarchy', function () {

            suite('Node', () => {

                suite('isData', () => {


                    test(`${/*++N*/'001'/**/} чистый лист — isData === true, данные доступны на узле`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['leaf'], data: { tag: 'x' } }
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots);
                        const leaf = roots.at(0);
                        assert.ok(leaf);
                        assert.ok(Hierarchy.Node.isData(leaf), 'isData must be true');
                        assert.strictEqual(leaf.tag, 'x', 'data must be present');
                    });


                    test(`${/*++N*/'002'/**/} промежуточный узел — spec ['parent', 'child'] → isData === false`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['parent', 'child'], data: { tag: 'x' } }
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots);
                        const parent = roots.at(0);
                        assert.ok(parent);
                        assert.ok(!Hierarchy.Node.isData(parent), 'isData must be false');
                    });


                    test(`${/*++N*/'003'/**/} true для и data, и branch одновременно`, function () {
                        const hierarchy = Hierarchy.build([
                            { path: ['parent', 'child'], data: { tag: 'child' } },
                            { path: ['parent'], data: { tag: 'parent data' } }
                        ]);
                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots);
                        const parent = roots.at(0);
                        assert.ok(parent);
                        assert.ok(Hierarchy.Node.isBranch(parent));
                        assert.ok(Hierarchy.Node.isData(parent));
                        assert.strictEqual(parent.tag, 'parent data', 'data must be present');
                    });

                });
            });
        });
    });
});
