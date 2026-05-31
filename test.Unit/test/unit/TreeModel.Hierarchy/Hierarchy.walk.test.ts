import * as assert from 'assert/strict';
import Hierarchy from 'src/TreeModel/Hierarchy';

// `${/*N=0*/'000'/**/}`

suite('Cockpit', function () {

    suite('TreeModel', function () {

        suite('Hierarchy', function () {

            suite('walk', function () {

                test(`${/*++N*/'001'/**/} обходит все узлы всех корней, каждый ровно один раз`, function () {

                    const hierarchy = Hierarchy.build([
                        { path: ['a', 'b'], data: { tag: 'A-b' } },
                        { path: ['a'], data: { tag: 'A-a' } },
                        { path: ['x'], data: { tag: 'B-x' } },
                    ]);

                    const visited: string[] = [];

                    Hierarchy.walk(hierarchy, (node) => {
                        visited.push(Hierarchy.Node.getSegment(node));
                    });

                    // a (branch+data), b (data), x (data) — 3 узла
                    assert.strictEqual(visited.length, 3,
                        `must visit 3 nodes, got: [${visited}]`);
                    assert.ok(visited.includes('a'));
                    assert.ok(visited.includes('b'));
                    assert.ok(visited.includes('x'));
                });


                test(`${/*++N*/'002'/**/} пустая иерархия → visitor не вызывается`, function () {

                    const hierarchy = Hierarchy.build([]);
                    let called = false;

                    Hierarchy.walk(hierarchy, () => { called = true; });

                    assert.ok(!called, 'visitor must not be called');
                });
            });

        });
    });
});
