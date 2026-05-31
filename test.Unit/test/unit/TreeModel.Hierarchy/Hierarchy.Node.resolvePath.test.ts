import * as assert from 'assert/strict';
import Hierarchy from 'src/TreeModel/Hierarchy';

// `${/*N=0*/'000'/**/}`

suite('Cockpit', function () {

    suite('TreeModel', function () {

        suite('Hierarchy', function () {

            suite('Node', () => {

                suite('resolvePath', () => {


                    test(`${/*++N*/'001'/**/} проверка resolvePath на промежуточном и листовом узлах`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['parent', 'child'], data: { tag: 'x' } },
                        ]);

                        const parent = Hierarchy.getRoots(hierarchy)[0];

                        assert.ok(parent, 'must exist');

                        assert.ok(Hierarchy.Node.isBranch(parent));
                        const child = Hierarchy.Node.getBranchChildren(parent)?.at(0);
                        assert.ok(child, 'must exist');

                        const childPath = Hierarchy.Node.resolvePath(child);

                        assert.deepStrictEqual(childPath, ['parent', 'child']);
                    });

                    // Структурный инвариант: resolvePath(child).path = parent.path + segment.
                    // path уникален в пределах дерева.
                    test(`${/*++N*/'002'/**/} path уникален в пределах дерева`, function () {
                        const hierarchy = Hierarchy.build([
                            { path: ['a', 'b', 'c'], data: { tag: '1' } },
                            { path: ['a', 'b', 'd'], data: { tag: '2' } },
                            { path: ['a'], data: { tag: '3' } },
                            { path: ['x', 'y'], data: { tag: '4' } },
                        ]);
                        const seen = new Set<string>();
                        function walk(
                            parentPath: string[] | null,
                            node: Hierarchy.Data<{ tag: string; }> | Hierarchy.Branch<{ tag: string; }>,
                        ): void {
                            const nodePath = Hierarchy.Node.resolvePath(node);
                            const key = nodePath.join('\0');
                            // uniqueness
                            assert.ok(!seen.has(key), `duplicate path: "${key}"`);
                            seen.add(key);
                            // structural: child path = [...parentPath, segment]
                            if (parentPath !== null) {
                                assert.deepStrictEqual(
                                    nodePath.slice(0, -1),
                                    parentPath,
                                    'child path must extend parent path',
                                );
                                assert.strictEqual(
                                    Hierarchy.Node.getSegment(node),
                                    nodePath.at(-1),
                                );
                            }
                            if (Hierarchy.Node.isBranch(node)) {
                                for (const child of Hierarchy.Node.getBranchChildren(node)) {
                                    walk(nodePath, child);
                                }
                            }
                        }
                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots.length > 0, 'precondition: tree is not empty');
                        for (const root of roots) {
                            walk(null, root);
                        }
                        // sanity: мы действительно обошли всё дерево
                        assert.strictEqual(seen.size, 6, 'must visit all 6 nodes (a, b, c, d, x, y)');
                    });

                });
            });
        });
    });
});
