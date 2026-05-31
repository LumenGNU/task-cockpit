import * as assert from 'assert/strict';
import Hierarchy from 'src/TreeModel/Hierarchy';

// `${/*N=0*/'000'/**/}`

suite('Cockpit', function () {

    suite('TreeModel', function () {

        suite('Hierarchy', function () {

            suite('lookup', function () {


                test(`${/*++N*/'001'/**/} находит листовой DataNode по полному пути`, function () {
                    const hierarchy = Hierarchy.build([
                        { path: ['a', 'b', 'c'], data: { tag: 'leaf' } },
                    ]);
                    const found = Hierarchy.lookup(hierarchy, ['a', 'b', 'c']);
                    assert.ok(found, 'must find the node');
                    assert.ok(Hierarchy.Node.isData(found));
                    assert.strictEqual(found.tag, 'leaf');
                });


                test(`${/*++N*/'002'/**/} находит промежуточный (чистый branch) узел`, function () {
                    const hierarchy = Hierarchy.build([
                        { path: ['a', 'b', 'c'], data: { tag: 'deep' } },
                    ]);
                    const found = Hierarchy.lookup(hierarchy, ['a', 'b']);
                    assert.ok(found, 'must find intermediate node');
                    assert.ok(Hierarchy.Node.isBranch(found), 'must be branch');
                    assert.ok(!Hierarchy.Node.isData(found), 'must not have data');
                    assert.strictEqual(Hierarchy.Node.getSegment(found), 'b');
                });


                test(`${/*++N*/'003'/**/} находит узел с двойной ролью (data + branch)`, function () {
                    const hierarchy = Hierarchy.build([
                        { path: ['A', 'a', 'b'], data: { tag: 'child' } },
                        { path: ['A', 'a'], data: { tag: 'parent' } },
                    ]);
                    const found = Hierarchy.lookup(hierarchy, ['A', 'a']);
                    assert.ok(found, 'must find the node');
                    assert.ok(Hierarchy.Node.isData(found), 'must have data');
                    assert.ok(Hierarchy.Node.isBranch(found), 'must have children');
                    assert.strictEqual(found.tag, 'parent');
                });


                suite('Edges', function () {


                    test(`${/*++N*/'004'/**/} пустой массив path → null`, function () {
                        const hierarchy = Hierarchy.build([
                            { path: ['a', 'b'], data: { tag: 'x' } }
                        ]);
                        assert.strictEqual(Hierarchy.lookup(hierarchy, []), null);
                    });


                    test(`${/*++N*/'005'/**/} пустая иерархия → null`, function () {
                        const hierarchy = Hierarchy.build([]);
                        assert.strictEqual(Hierarchy.lookup(hierarchy, ['anything']), null);
                    });


                    test(`${/*++N*/'006'/**/} первый сегмент существует, второй — нет → null`, function () {
                        const hierarchy = Hierarchy.build([
                            { path: ['a', 'b'], data: { tag: 'x' } }
                        ]);
                        const found = Hierarchy.lookup(hierarchy, ['a', 'nope']);
                        assert.strictEqual(found, null);
                    });


                    test(`${/*++N*/'007'/**/} полностью несуществующий путь → null`, function () {
                        const hierarchy = Hierarchy.build([
                            { path: ['a', 'b'], data: { tag: 'x' } }
                        ]);
                        const found = Hierarchy.lookup(hierarchy, ['zzz']);
                        assert.strictEqual(found, null);
                    });


                    test(`${/*++N*/'008'/**/} путь длиннее дерева (проходит сквозь лист) → null`, function () {
                        const hierarchy = Hierarchy.build([
                            { path: ['a'], data: { tag: 'x' } }
                        ]);
                        const nodeA = Hierarchy.lookup(hierarchy, ['a']);
                        assert.ok(nodeA);
                        assert.ok(!Hierarchy.Node.isBranch(nodeA), 'precondition: leaf has no children');
                        const found = Hierarchy.lookup(hierarchy, ['a', 'ghost']);
                        assert.strictEqual(found, null);
                    });

                });

            });

        });
    });
});
