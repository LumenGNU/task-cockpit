import * as assert from 'assert/strict';
import Hierarchy from '../../../src/Cockpit/TreeModel/Hierarchy';

// `${/*N=0*/'000'/**/}`

suite('Cockpit', function () {

    suite('TreeModel', function () {

        suite('Hierarchy', function () {

            suite('Node', function () {

                suite('getData (field access)', function () {


                    test(`${/*++N*/'001'/**/} произвольные поля данных доступны на DataNode как собственные свойства`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['leaf'], data: { label: 'hello', priority: 1, hole: null, empty: undefined, dtt: new Date() } },
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots);
                        const leaf = roots.at(0);
                        assert.ok(leaf, 'must exist');
                        assert.ok(Hierarchy.Node.isData(leaf));
                        assert.strictEqual(leaf.label, 'hello');
                        assert.strictEqual(leaf.priority, 1);
                        assert.strictEqual(leaf.hole, null);
                        assert.strictEqual(leaf.empty, undefined);
                        assert.ok(leaf.dtt instanceof Date);
                    });


                    test(`${/*++N*/'002'/**/} возвращает чистый payload без структурных полей иерархии`, function () {

                        const payload = { tag: 'hello', priority: 1 };

                        const hierarchy = Hierarchy.build([
                            { path: ['leaf'], data: payload },
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);
                        const leaf = roots.at(0);
                        assert.ok(leaf, 'precondition');
                        assert.ok(Hierarchy.Node.isData(leaf), 'precondition');

                        const data = Hierarchy.Node.getData(leaf);
                        assert.strictEqual(data.tag, 'hello');
                        assert.strictEqual(data.priority, 1);
                        assert.deepStrictEqual(Object.keys(data).sort(), ['priority', 'tag']);
                    });


                    test(`${/*++N*/'003'/**/} на data+branch узле — возвращает payload, не структурные поля`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['parent', 'child'], data: { tag: 'child' } },
                            { path: ['parent'], data: { tag: 'parent-data' } },
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);

                        const parent = roots.at(0);
                        assert.ok(parent, 'precondition');
                        assert.ok(Hierarchy.Node.isData(parent), 'precondition: must be data');
                        assert.ok(Hierarchy.Node.isBranch(parent), 'precondition: must be branch');

                        const data = Hierarchy.Node.getData(parent);
                        assert.strictEqual(data.tag, 'parent-data');
                        assert.deepStrictEqual(Object.keys(data).sort(), ['tag']);
                    });


                    test(`${/*++N*/'004'/**/} пустой payload → пустой объект`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['leaf'], data: {} },
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);

                        const leaf = roots.at(0);
                        assert.ok(leaf, 'precondition');
                        assert.ok(Hierarchy.Node.isData(leaf), 'precondition');

                        const data = Hierarchy.Node.getData(leaf);
                        assert.deepStrictEqual(Object.keys(data), []);
                    });


                    suite('Edges', function () {

                        test(`${/*++N*/'005'/**/} data node exposes only payload keys as own enumerable properties`, function () {

                            const hierarchy = Hierarchy.build([
                                { path: ['solo'], data: {} },
                            ]);

                            const roots = Hierarchy.getRoots(hierarchy);
                            assert.ok(roots);
                            const solo = roots.at(0);
                            assert.ok(solo, 'node must exist');
                            assert.ok(Hierarchy.Node.isData(solo));

                            assert.deepStrictEqual(
                                Object.keys(solo),
                                [],
                                `Empty payload must produce zero own enumerable keys, got: ${JSON.stringify(Object.keys(solo))}`,
                            );
                        });


                        test(`${/*++N*/'006'/**/} перезапись полностью замещает старый payload: лишние ключи предыдущего spec удаляются`, function () {

                            const hierarchy = Hierarchy.build([
                                { path: ['target'], data: { tag: 'old', extra: 42 } },
                                { path: ['target'], data: { tag: 'new' } },
                            ]);

                            const roots = Hierarchy.getRoots(hierarchy);
                            assert.ok(roots);

                            assert.strictEqual(roots.length, 1);

                            const node = roots.at(0);
                            assert.ok(node, 'precondition');
                            assert.ok(Hierarchy.Node.isData(node));
                            assert.strictEqual(node.tag, 'new', 'new tag must win');
                            assert.ok(
                                !('extra' in node),
                                `stale key "extra" must be removed, got: ${JSON.stringify(node)}`,
                            );
                        });
                    });
                });
            });
        });
    });
});

