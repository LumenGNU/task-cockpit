import * as assert from 'assert/strict';
import Hierarchy from 'src/TreeModel/Hierarchy';

// `${/*N=0*/'000'/**/}`

suite('Cockpit', function () {

    suite('TreeModel', function () {

        suite('Hierarchy', function () {

            suite('getRoots', function () {

                test(`${/*++N*/'001'/**/} getRoots returns a detached copy — mutation does not corrupt hierarchy`, function () {

                    const hierarchy = Hierarchy.build([
                        { path: ['a'], data: { tag: 'x' } },
                        { path: ['b'], data: { tag: 'y' } },
                    ]);

                    const roots1 = Hierarchy.getRoots(hierarchy);
                    assert.strictEqual(roots1.length, 2, 'precondition');

                    // @ts-ignore
                    roots1.length = 0;

                    const roots2 = Hierarchy.getRoots(hierarchy);
                    assert.strictEqual(roots2.length, 2, 'hierarchy must not be affected by mutation of previous result');
                    assert.deepStrictEqual(Hierarchy.getRoots(hierarchy), roots2);
                });

            });

        });
    });
});