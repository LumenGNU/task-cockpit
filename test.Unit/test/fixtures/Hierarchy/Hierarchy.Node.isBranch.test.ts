import * as assert from 'assert/strict';
import Hierarchy from '../../../src/Cockpit/TreeModel/Hierarchy';

// `${/*N=0*/'000'/**/}`

suite('Cockpit', function () {

    suite('TreeModel', function () {

        suite('Hierarchy', function () {

            suite('Node', function () {

                suite('isBranch', function () {

                    // Чистый лист — isBranch === false.
                    test(`${/*++N*/'001'/**/} false for pure leaf`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['leaf'], data: { tag: 'x' } }
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots);
                        const leaf = roots.at(0);
                        assert.ok(leaf);
                        assert.ok(!Hierarchy.Node.isBranch(leaf), 'isBranch must be false');
                    });


                    // Промежуточный узел — spec ['parent', 'child'] → isBranch === true.
                    test(`${/*++N*/'002'/**/} true for intermediate node`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['parent', 'child'], data: { tag: 'x' } }
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots);
                        const parent = roots.at(0);
                        assert.ok(parent);
                        assert.ok(Hierarchy.Node.isBranch(parent), 'isBranch must be true');
                    });

                });
            });
        });
    });
});
