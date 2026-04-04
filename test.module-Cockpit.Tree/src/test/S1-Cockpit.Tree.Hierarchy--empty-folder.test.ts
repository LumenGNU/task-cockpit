import * as assert from 'assert/strict';
import Hierarchy from '../Cockpit/TreeModel/Hierarchy';


type PLoad = { tag: string; };


const SCOPE = '<S-id>';


function spec(path: ReadonlyArray<string>, data: PLoad): Hierarchy.Spec<PLoad, typeof SCOPE>;
function spec<D extends object>(path: ReadonlyArray<string>, data: D): Hierarchy.Spec<D, typeof SCOPE>;
function spec<S extends string>(path: ReadonlyArray<string>, data: PLoad, scope: S): Hierarchy.Spec<PLoad, S>;
function spec<D extends object, S extends string = typeof SCOPE>(
    path: ReadonlyArray<string>, data: D, scope?: S
): Hierarchy.Spec<D, S> {
    return { scope: (scope ?? SCOPE) as S, path: [...path], data };
}


function nodePathCheck(node: Hierarchy.Data<PLoad, string> | Hierarchy.Branch<PLoad, string>, expectScopeId: string, ...expectSegments: string[]): void {

    const { scope, path } = Hierarchy.Node.resolvePath(node);

    assert.strictEqual(scope, expectScopeId, 'scopeId must match');
    assert.deepStrictEqual(path, expectSegments, 'segments must match');
}


/** Извлечь top-level узлы scope из результата build. */
function topNodesToArray<D extends object, S extends string>(hierarchy: Hierarchy<D, S>, scopeId?: S) {
    const id = (scopeId ?? SCOPE) as S;
    const scope = Hierarchy.getScope(hierarchy, id);
    if (!scope) return [];
    return [...Hierarchy.Scope.getChildren(scope)];
}


suite('@module Cockpit/Tree/Hierarchy', function () {

    suite('build', () => {

        suite('Node.isData', () => {

            // Чистый лист — isData === true, данные доступны на узле.
            test('true for pure leaf', function () {
                const topNodes = topNodesToArray(
                    Hierarchy.build([spec(['leaf'], { tag: 'x' })])
                );
                const leaf = topNodes.at(0);
                assert.ok(leaf);
                assert.ok(Hierarchy.Node.isData(leaf), 'isData must be true');
                assert.strictEqual(leaf.tag, 'x', 'data must be present');
            });


            // Промежуточный узел — spec ['parent', 'child'] → isData === false.
            test('false for intermediate node', function () {
                const topNodes = topNodesToArray(
                    Hierarchy.build([spec(['parent', 'child'], { tag: 'x' })])
                );
                const parent = topNodes.at(0);
                assert.ok(parent);
                assert.ok(!Hierarchy.Node.isData(parent), 'isData must be false');
            });


            // DataNode с детьми — ['parent'] + ['parent', 'child'] →
            // узел parent — и data, и branch одновременно.
            test('true for data node with children', function () {
                const topNodes = topNodesToArray(
                    Hierarchy.build([
                        spec(['parent', 'child'], { tag: 'child' }),
                        spec(['parent'], { tag: 'parent data' }),
                    ])
                );
                const parent = topNodes.at(0);
                assert.ok(parent);
                assert.ok(Hierarchy.Node.isBranch(parent));
                assert.ok(Hierarchy.Node.isData(parent));
                assert.strictEqual(parent.tag, 'parent data', 'data must be present');
            });

        });


        suite('Node.isBranch', () => {

            // Чистый лист — isBranch === false.
            test('false for pure leaf', function () {
                const topNodes = topNodesToArray(
                    Hierarchy.build([spec(['leaf'], { tag: 'x' })])
                );
                const leaf = topNodes.at(0);
                assert.ok(leaf);
                assert.ok(!Hierarchy.Node.isBranch(leaf), 'isBranch must be false');
            });


            // Промежуточный узел — spec ['parent', 'child'] → isBranch === true.
            test('true for intermediate node', function () {
                const topNodes = topNodesToArray(
                    Hierarchy.build([spec(['parent', 'child'], { tag: 'x' })])
                );
                const parent = topNodes.at(0);
                assert.ok(parent);
                assert.ok(Hierarchy.Node.isBranch(parent), 'isBranch must be true');
            });

        });


        suite('Node.getParent', () => {

            // Корневой узел → parent — это Scope-узел.
            test('returns Scope for root node', function () {

                const hierarchy = Hierarchy.build([
                    spec(['a', 'b'], { tag: 'x' }),
                ]);
                const topNodes = topNodesToArray(hierarchy);
                const root = topNodes[0];
                assert.ok(root, 'precondition');
                const parent = Hierarchy.Node.getParent(root);
                const scope = Hierarchy.getScope(hierarchy, SCOPE);
                assert.ok(scope, 'scope must exist');
                assert.strictEqual(parent, scope, 'parent of root node must be the scope node');
            });

            // Лист возвращает своего непосредственного родителя.
            test('returns immediate parent for leaf', function () {
                const topNodes = topNodesToArray(
                    Hierarchy.build([
                        spec(['a', 'b'], { tag: 'leaf' }),
                    ])
                );
                const parent = topNodes[0];
                assert.ok(parent, 'precondition');
                assert.ok(Hierarchy.Node.isBranch(parent));
                const leaf = Hierarchy.Node.getBranchChildren(parent).at(0);
                assert.ok(leaf, 'precondition');
                assert.ok(Hierarchy.Node.isData(leaf));
                assert.strictEqual(Hierarchy.Node.getParent(leaf), parent);
            });

            // Промежуточный узел возвращает своего родителя.
            test('returns parent for intermediate node', function () {
                const topNodes = topNodesToArray(
                    Hierarchy.build([
                        spec(['a', 'b', 'c'], { tag: 'deep' }),
                    ])
                );
                const nodeA = topNodes[0];
                assert.ok(nodeA, 'precondition');
                assert.ok(Hierarchy.Node.isBranch(nodeA));
                const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                assert.ok(nodeB, 'precondition');
                assert.ok(Hierarchy.Node.isBranch(nodeB));
                assert.strictEqual(Hierarchy.Node.getParent(nodeB), nodeA);
            });

        });


        suite('resolvePath', () => {

            // Проверка resolvePath на промежуточном и листовом узлах.
            test('resolvePath encodes scope and segments correctly', function () {

                const topNodes = topNodesToArray(
                    Hierarchy.build([
                        spec(['parent', 'child'], { tag: 'x' }),
                    ])
                );

                assert.strictEqual(topNodes.length, 1);

                const parent = topNodes.at(0);
                assert.ok(parent, 'must exist');
                nodePathCheck(parent, SCOPE, 'parent');
                assert.ok(Hierarchy.Node.isBranch(parent));
                const child = Hierarchy.Node.getBranchChildren(parent)?.at(0);
                assert.ok(child, 'must exist');
                nodePathCheck(child, SCOPE, 'parent', 'child');
            });


            // Разные scope → разные resolvePath для одинаковых path.
            test('different scopes produce different resolved paths', function () {

                const hierarchyA = Hierarchy.build([
                    { scope: 'scope-A', path: ['node'], data: { tag: 'a' } },
                ]);
                const hierarchyB = Hierarchy.build([
                    { scope: 'scope-B', path: ['node'], data: { tag: 'b' } },
                ]);

                const treeA = topNodesToArray(hierarchyA, 'scope-A');
                const treeB = topNodesToArray(hierarchyB, 'scope-B');

                const nodeA = treeA.at(0);
                assert.ok(nodeA);
                nodePathCheck(nodeA, 'scope-A', 'node');
                assert.ok(Hierarchy.Node.isData(nodeA));
                assert.strictEqual(nodeA.tag, 'a');

                const nodeB = treeB.at(0);
                assert.ok(nodeB);
                nodePathCheck(nodeB, 'scope-B', 'node');
                assert.ok(Hierarchy.Node.isData(nodeB));
                assert.strictEqual(nodeB.tag, 'b');

            });


            // Структурный инвариант: resolvePath(child).path = parent.path + segment.
            // path уникален в пределах дерева.
            test('child path extends parent path; resolved paths are unique', function () {

                const s1 = ['a', 'b', 'c'];
                const s2 = ['a', 'b', 'd'];
                const s3 = ['a'];
                const s4 = ['x', 'y'];

                const topNodes = topNodesToArray(
                    Hierarchy.build([
                        spec(s1, { tag: '1' }),
                        spec(s2, { tag: '2' }),
                        spec(s3, { tag: '3' }),
                        spec(s4, { tag: '4' }),
                    ])
                );

                const seen = new Set<string>();

                function walk(parent: Hierarchy.Data<PLoad, string> | Hierarchy.Branch<PLoad, string> | null, node: Hierarchy.Data<PLoad, string> | Hierarchy.Branch<PLoad, string>): void {

                    const np = Hierarchy.Node.resolvePath(node);

                    const nodePath = [np.scope, ...np.path].join('\0-\0-\0');

                    // uniqueness
                    assert.ok(
                        !seen.has(nodePath),
                        `duplicate nodePath: "${nodePath}"`
                    );
                    seen.add(nodePath);

                    // structural: child.path = [...parent.path, segment]
                    if (parent) {
                        const parentParsed = Hierarchy.Node.resolvePath(parent);
                        const childParsed = Hierarchy.Node.resolvePath(node);
                        assert.strictEqual(childParsed.scope, parentParsed.scope);

                        assert.deepStrictEqual(
                            childParsed.path.slice(0, -1),
                            parentParsed.path,
                            `child path must extend parent path`
                        );

                        assert.strictEqual(
                            Hierarchy.Node.getSegment(node),
                            childParsed.path.at(-1)
                        );
                    }

                    if (Hierarchy.Node.isBranch(node)) {
                        for (const child of Hierarchy.Node.getBranchChildren(node)) {
                            walk(node, child);
                        }
                    }
                }

                assert.ok(topNodes.length > 0, 'precondition: tree is not empty');
                for (const root of topNodes) {
                    walk(null, root);
                }

                // sanity: мы действительно обошли всё дерево
                const expUniqSize = new Set(
                    [s1, s2, s3, s4].flatMap(s => s.map((_, i) => JSON.stringify(s.slice(0, i + 1))))
                ).size;
                assert.strictEqual(seen.size, expUniqSize, `expected ${expUniqSize} nodes, got ${seen.size}`);
            });

        });


        suite('Data Properties', () => {

            // Произвольные поля данных доступны на DataNode как собственные свойства.
            test('data fields accessible on DataNode', function () {
                const topNodes = topNodesToArray(
                    Hierarchy.build([
                        { scope: SCOPE, path: ['leaf'], data: { label: 'hello', priority: 1, hole: null, empty: undefined, dtt: new Date() } },
                    ])
                );
                const leaf = topNodes.at(0);
                assert.ok(leaf, 'must exist');
                assert.ok(Hierarchy.Node.isData(leaf));
                assert.strictEqual(leaf.label, 'hello');
                assert.strictEqual(leaf.priority, 1);
                assert.strictEqual(leaf.hole, null);
                assert.strictEqual(leaf.empty, undefined);
                assert.ok(leaf.dtt instanceof Date);
            });


            suite('Edges', () => {

                test('data node exposes only payload keys as own enumerable properties', function () {

                    const topNodes = topNodesToArray(
                        Hierarchy.build([
                            spec(['solo'], {}),
                        ])
                    );
                    const node = topNodes.at(0);
                    assert.ok(node, 'node must exist');
                    assert.ok(Hierarchy.Node.isData(node));

                    assert.deepStrictEqual(
                        Object.keys(node),
                        [],
                        `Empty payload must produce zero own enumerable keys, got: ${JSON.stringify(Object.keys(node))}`
                    );
                });


                // Перезапись полностью замещает старый payload: лишние ключи предыдущего spec удаляются.
                test('duplicate path removes stale keys from previous data', function () {
                    const topNodes = topNodesToArray(
                        Hierarchy.build<{ tag: string, extra?: any; }, typeof SCOPE>([
                            { scope: SCOPE, path: ['target'], data: { tag: 'old', extra: 42 } },
                            { scope: SCOPE, path: ['target'], data: { tag: 'new' } },
                        ])
                    );

                    assert.strictEqual(topNodes.length, 1);
                    const node = topNodes[0];
                    assert.ok(node, 'precondition');
                    assert.ok(Hierarchy.Node.isData(node));
                    assert.strictEqual(node.tag, 'new', 'new tag must win');
                    assert.ok(
                        !('extra' in node),
                        `stale key "extra" must be removed, got: ${JSON.stringify(node)}`
                    );
                });

            });

        });


        // структура дерева
        // ядро модуля
        suite('Tree Structure (core)', () => {

            // Минимальное дерево: один spec → один корневой DataNode с данными и корректным path.
            test('single segment produces one root DataNode', function () {

                const segments = ['leaf'];
                const topNodes = topNodesToArray(
                    Hierarchy.build([spec(segments, { tag: 'x' })])
                );

                const leaf = topNodes.at(0);
                assert.ok(leaf, 'leaf must exist');
                assert.ok(Hierarchy.Node.isData(leaf), 'leaf must be DataNode');
                assert.ok(!Hierarchy.Node.isBranch(leaf), 'pure leaf must not be branch');
                assert.strictEqual(leaf.tag, 'x');

                nodePathCheck(leaf, SCOPE, ...segments);
            });


            // Глубокая цепочка (3 уровня): промежуточные — чистые branch'и, данные только на листе.
            test('chained segments produce nested nodes with data on leaf', function () {

                const segments = ['a', 'b', 'c'];

                const topNodes = topNodesToArray(
                    Hierarchy.build([
                        spec(segments, { tag: 'deep' }),
                    ])
                );

                assert.strictEqual(topNodes.length, 1);

                const nodeA = topNodes.at(0);
                assert.ok(nodeA, 'nodeA must exist');
                assert.ok(Hierarchy.Node.isBranch(nodeA), 'nodeA must be branch');
                assert.ok(!Hierarchy.Node.isData(nodeA), 'nodeA must not have data');

                nodePathCheck(nodeA, SCOPE, ...segments.slice(0, 1));

                const nodeB = Hierarchy.Node.getBranchChildren(nodeA)?.at(0);
                assert.ok(nodeB, 'nodeB must exist');
                assert.ok(Hierarchy.Node.isBranch(nodeB), 'nodeB must be branch');
                assert.ok(!Hierarchy.Node.isData(nodeB), 'nodeB must not have data');

                nodePathCheck(nodeB, SCOPE, ...segments.slice(0, 2));

                const nodeC = Hierarchy.Node.getBranchChildren(nodeB)?.at(0);
                assert.ok(nodeC, 'nodeC must exist');
                assert.ok(!Hierarchy.Node.isBranch(nodeC), 'nodeC must not be branch');
                assert.ok(Hierarchy.Node.isData(nodeC), 'nodeC must have data');
                assert.strictEqual(nodeC.tag, 'deep', 'nodeC must have tag "deep"');
                nodePathCheck(nodeC, SCOPE, ...segments.slice(0, 3));
            });


            // Порядок children внутри ветки соответствует порядку поступления spec'ов.
            test('children order within a branch follows spec insertion order', function () {

                const topNodes = topNodesToArray(
                    Hierarchy.build([
                        spec(['trunk', 'alpha'], { tag: 'a' }),
                        spec(['trunk', 'gamma'], { tag: 'g' }),
                        spec(['trunk', 'beta'], { tag: 'b' }),
                    ])
                );

                assert.strictEqual(topNodes.length, 1);
                const trunk = topNodes[0];
                assert.ok(trunk, 'precondition');
                assert.ok(Hierarchy.Node.isBranch(trunk));

                const children = Hierarchy.Node.getBranchChildren(trunk);
                assert.strictEqual(children.length, 3, 'trunk must have 3 children');

                assert.strictEqual(Hierarchy.Node.getSegment(children[0]), 'alpha');
                assert.strictEqual(Hierarchy.Node.getSegment(children[1]), 'gamma');
                assert.strictEqual(Hierarchy.Node.getSegment(children[2]), 'beta');

                const topNodes2 = topNodesToArray(
                    Hierarchy.build([
                        spec(['trunk', 'beta'], { tag: 'b' }),
                        spec(['trunk', 'alpha'], { tag: 'a' }),
                        spec(['trunk', 'gamma'], { tag: 'g' }),
                    ])
                );

                assert.strictEqual(topNodes2.length, 1);
                const trunk2 = topNodes2[0];
                assert.ok(trunk2, 'precondition');
                assert.ok(Hierarchy.Node.isBranch(trunk2));

                const children2 = Hierarchy.Node.getBranchChildren(trunk2);
                assert.strictEqual(children2.length, 3, 'trunk2 must have 3 children');

                assert.strictEqual(Hierarchy.Node.getSegment(children2[0]), 'beta');
                assert.strictEqual(Hierarchy.Node.getSegment(children2[1]), 'alpha');
                assert.strictEqual(Hierarchy.Node.getSegment(children2[2]), 'gamma');
            });


            // Переиспользование узлов: два spec'а с общим префиксом → один промежуточный trunk.
            test('shared prefix reuses intermediate node', function () {

                const branchL = spec(['trunk', 'left'], { tag: 'L' });
                const branchR = spec(['trunk', 'right'], { tag: 'R' });

                const topNodes = topNodesToArray(
                    Hierarchy.build([
                        branchL,
                        branchR
                    ])
                );

                assert.strictEqual(topNodes.length, 1, 'shared trunk = one root');

                const trunk = topNodes.at(0);
                assert.ok(trunk, 'trunk must exist');

                assert.ok(!Hierarchy.Node.isData(trunk), 'trunk is pure intermediate');

                assert.ok(Hierarchy.Node.isBranch(trunk));

                assert.strictEqual(Hierarchy.Node.getBranchChildren(trunk)?.length, 2, 'trunk has two children');

                const left = Hierarchy.Node.getBranchChildren(trunk)?.at(0);
                const right = Hierarchy.Node.getBranchChildren(trunk)?.at(1);

                assert.ok(left, 'left must exist');
                assert.strictEqual(Hierarchy.Node.getSegment(left), 'left', 'left must have segment "left"');
                assert.ok(Hierarchy.Node.isData(left), 'left must be DataNode');
                assert.strictEqual(left.tag, 'L', 'left must have tag "L"');

                assert.ok(right, 'right must exist');
                assert.strictEqual(Hierarchy.Node.getSegment(right), 'right', 'right must have segment "right"');
                assert.ok(Hierarchy.Node.isData(right), 'right must be DataNode');
                assert.strictEqual(right.tag, 'R', 'right must have tag "R"');

            });


            // Двойная роль: узел одновременно несёт данные и имеет детей.
            test('node can be both data and branch', function () {

                const topNodes = topNodesToArray(
                    Hierarchy.build([
                        spec(['a', 'b', 'c'], { tag: 'c-data' }),
                        spec(['a', 'b'], { tag: 'b-data' }),
                        spec(['a'], { tag: 'a-data' }),
                    ])
                );

                assert.strictEqual(topNodes.length, 1);

                const nodeA = topNodes.at(0);
                assert.ok(nodeA, 'nodeA must exist');
                assert.ok(Hierarchy.Node.isBranch(nodeA), 'nodeA must be branch');
                assert.ok(Hierarchy.Node.isData(nodeA), 'nodeA must have data');
                assert.strictEqual(nodeA.tag, 'a-data', 'nodeA must have tag "a-data"');
                nodePathCheck(nodeA, SCOPE, 'a');

                const nodeB = Hierarchy.Node.getBranchChildren(nodeA)?.at(0);
                assert.ok(nodeB, 'nodeB must exist');
                assert.ok(Hierarchy.Node.isBranch(nodeB), 'nodeB must be branch');
                assert.ok(Hierarchy.Node.isData(nodeB), 'nodeB must have data');
                assert.strictEqual(nodeB.tag, 'b-data', 'nodeB must have tag "b-data"');
                nodePathCheck(nodeB, SCOPE, 'a', 'b');

                const nodeC = Hierarchy.Node.getBranchChildren(nodeB)?.at(0);
                assert.ok(nodeC, 'nodeC must exist');
                assert.ok(!Hierarchy.Node.isBranch(nodeC), 'nodeC must not be branch');
                assert.ok(Hierarchy.Node.isData(nodeC), 'nodeC must have data');
                assert.strictEqual(nodeC.tag, 'c-data', 'nodeC must have tag "c-data"');
                nodePathCheck(nodeC, SCOPE, 'a', 'b', 'c');
            });


            // Контракт позиционирования: ветка встаёт на позицию в порядке поступления спецификации.
            test('branch position follows first occurrence', function () {

                const x = spec(['x'], { tag: 'x' });
                const y = spec(['y'], { tag: 'y' });
                const z = spec(['z'], { tag: 'z' });

                const items = [x, y, z];
                const names = ['x', 'y', 'z'];

                // все шесть перестановок
                for (const [i, j, k] of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {

                    const result = topNodesToArray(
                        Hierarchy.build([items[i], items[j], items[k]])
                    );

                    // Быстрая проверка
                    assert.strictEqual(result.length, 3);
                    assert.strictEqual((result[0] as any).tag, names[i], `[0] in permutation ${names[i]}, ${names[j]}, ${names[k]} must be ${names[i]}`);
                    assert.strictEqual((result[1] as any).tag, names[j], `[1] in permutation ${names[i]}, ${names[j]}, ${names[k]} must be ${names[j]}`);
                    assert.strictEqual((result[2] as any).tag, names[k], `[2] in permutation ${names[i]}, ${names[j]}, ${names[k]} must be ${names[k]}`);
                }

            });


            // Структурный инвариант:
            // Дерево определяется только набором путей, а не процессом их накопления.
            test('spec order does not affect tree structure', function () {

                const root = spec(['a'], { tag: '1' });
                const shallow = spec(['a', 'b'], { tag: '2' });
                const deep = spec(['a', 'b', 'c'], { tag: '3' });

                const items = [root, deep, shallow];
                const names = ['root', 'deep', 'shallow'];

                const expected = topNodesToArray(
                    Hierarchy.build([items[0], items[1], items[2]])
                );

                // Быстрая проверка образца на "правильность"
                assert.strictEqual(expected.length, 1);

                const a1 = expected[0];
                assert.ok(Hierarchy.Node.isData(a1));
                assert.strictEqual(a1.tag, '1', 'a - tag must match');

                assert.ok(Hierarchy.Node.isBranch(a1));
                const b2 = Hierarchy.Node.getBranchChildren(a1)[0];
                assert.ok(Hierarchy.Node.isData(b2));
                assert.strictEqual(b2.tag, '2', 'b - tag must match');
                assert.ok(Hierarchy.Node.isBranch(b2));
                const c3 = Hierarchy.Node.getBranchChildren(b2)[0];
                assert.ok(Hierarchy.Node.isData(c3));
                assert.strictEqual(c3.tag, '3', 'c - tag must match');

                // все 5 перестановок
                for (const [i, j, k] of [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
                    const result = topNodesToArray(
                        Hierarchy.build([items[i], items[j], items[k]])
                    );
                    assert.deepStrictEqual(result, expected, `expected must match in permutation ${names[i]}, ${names[j]}, ${names[k]}`);
                }

            });


            suite('Edges', () => {

                // Тест на пустой ввод.
                test('empty specs produce no root nodes', function () {
                    const topNodes = topNodesToArray(
                        Hierarchy.build([])
                    );
                    assert.strictEqual(topNodes.length, 0);
                });


                // Семантика перезаписи: последний spec выигрывает.
                test('duplicate path overwrites data', function () {

                    const topNodes = topNodesToArray(
                        Hierarchy.build([
                            spec(['target'], { tag: 'original' }),
                            spec(['target'], { tag: 'replacement' }),
                        ])
                    );

                    assert.strictEqual(topNodes.length, 1);

                    const node = topNodes.at(0);
                    assert.ok(node, 'must exist');
                    assert.ok(Hierarchy.Node.isData(node), 'must remain DataNode');
                    assert.strictEqual(node.tag, 'replacement', 'later spec wins');
                });


                // Граничный случай: scopeId === segment на всех уровнях.
                test('scopeId identical to all segments does not collapse the tree', function () {

                    const V = 'same';

                    const topNodes = topNodesToArray(
                        Hierarchy.build([
                            { scope: V, path: [V, V, V], data: { tag: 'leaf' } },
                            { scope: V, path: [V], data: { tag: 'root-data' } },
                        ]),
                        V
                    );

                    assert.strictEqual(topNodes.length, 1, 'single root branch');

                    const root = topNodes.at(0);
                    assert.ok(root, 'must exist');
                    assert.strictEqual(Hierarchy.Node.getSegment(root), V);
                    nodePathCheck(root, V, V);
                    assert.ok(Hierarchy.Node.isData(root), 'root must carry data');
                    assert.ok(Hierarchy.Node.isBranch(root), 'root must be branch');
                    assert.strictEqual(root.tag, 'root-data');

                    assert.strictEqual(Hierarchy.Node.getBranchChildren(root)?.length, 1);
                    const mid = Hierarchy.Node.getBranchChildren(root)?.at(0);
                    assert.ok(mid, 'must exist');
                    assert.strictEqual(Hierarchy.Node.getSegment(mid), V);
                    nodePathCheck(mid, V, V, V);
                    assert.ok(!Hierarchy.Node.isData(mid), 'intermediate must not have data');
                    assert.ok(Hierarchy.Node.isBranch(mid), 'intermediate must be branch');

                    assert.strictEqual(Hierarchy.Node.getBranchChildren(mid)?.length, 1);
                    const leaf = Hierarchy.Node.getBranchChildren(mid)?.at(0);
                    assert.ok(leaf, 'must exist');
                    assert.strictEqual(Hierarchy.Node.getSegment(leaf), V);
                    nodePathCheck(leaf, V, V, V, V);
                    assert.ok(Hierarchy.Node.isData(leaf), 'leaf must have data');
                    assert.strictEqual(leaf.tag, 'leaf');
                    assert.ok(!Hierarchy.Node.isBranch(leaf), 'leaf must not be branch');
                });


                // Спецификация с пустым массивом сегментов — молча игнорируется.
                test('spec with empty segments is silently skipped', function () {

                    const items: Hierarchy.Spec<PLoad, typeof SCOPE>[] = [
                        /*0*/ { scope: SCOPE, path: [], data: { tag: 'y' } },
                        /*1*/ { scope: SCOPE, path: ['X'], data: { tag: 'X' } },
                        /*2*/ { scope: SCOPE, path: ['Z'], data: { tag: 'Z' } },
                    ];

                    for (const [i, j, k] of [[0, 1, 2], [1, 0, 2], [1, 2, 0]]) {

                        const p = `permutation [${i},${j},${k}]`;
                        const topNodes = topNodesToArray(
                            Hierarchy.build([items[i], items[j], items[k]])
                        );

                        assert.strictEqual(topNodes.length, 2, `${p}: spec with empty segments must not produce a node`);

                        const first = topNodes.at(0);
                        assert.ok(first, `${p}: first must exist`);
                        nodePathCheck(first, SCOPE, 'X');
                        assert.ok(Hierarchy.Node.isData(first), `${p}: first must be DataNode`);
                        assert.ok(!Hierarchy.Node.isBranch(first), `${p}: first must not be branch`);
                        assert.strictEqual(first.tag, 'X', `${p}: first tag must match`);

                        const second = topNodes.at(1);
                        assert.ok(second, `${p}: second must exist`);
                        nodePathCheck(second, SCOPE, 'Z');
                        assert.ok(Hierarchy.Node.isData(second), `${p}: second must be DataNode`);
                        assert.ok(!Hierarchy.Node.isBranch(second), `${p}: second must not be branch`);
                        assert.strictEqual(second.tag, 'Z', `${p}: second tag must match`);
                    }
                });


                // Алгоритм защищен от пустого scopeId, и КОРРЕКТНО с ним работает
                test('resolvePath correctly recovers empty scopeId', function () {

                    const segments = ['a', 'b', 'c'];
                    const emptyScopeId = '';

                    const topNodes = topNodesToArray(
                        Hierarchy.build([
                            { scope: emptyScopeId, path: segments, data: { tag: 'leaf' } },
                        ]),
                        emptyScopeId
                    );

                    assert.strictEqual(topNodes.length, 1, 'single root branch');

                    const nodeA = topNodes.at(0);
                    assert.ok(nodeA, 'nodeA must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeA), 'nodeA must be branch');
                    assert.ok(!Hierarchy.Node.isData(nodeA), 'nodeA must not have data');
                    nodePathCheck(nodeA, emptyScopeId, ...segments.slice(0, 1));

                    const nodeB = Hierarchy.Node.getBranchChildren(nodeA)?.at(0);
                    assert.ok(nodeB, 'nodeB must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeB), 'nodeB must be branch');
                    assert.ok(!Hierarchy.Node.isData(nodeB), 'nodeB must not have data');
                    nodePathCheck(nodeB, emptyScopeId, ...segments.slice(0, 2));

                    const nodeC = Hierarchy.Node.getBranchChildren(nodeB)?.at(0);
                    assert.ok(nodeC, 'nodeC must exist');
                    assert.ok(!Hierarchy.Node.isBranch(nodeC), 'nodeC must not be branch');
                    assert.ok(Hierarchy.Node.isData(nodeC), 'nodeC must have data');
                    assert.strictEqual(nodeC.tag, 'leaf', 'nodeC must have tag "leaf"');
                    nodePathCheck(nodeC, emptyScopeId, ...segments.slice(0, 3));

                });


                // Алгоритм защищен от сегментов, состоящих из пустых строк
                test('resolvePath correctly recovers empty segments', function () {

                    const segments = ['a', '', 'c'];

                    const topNodes = topNodesToArray(
                        Hierarchy.build([
                            spec(segments, { tag: 'leaf' }),
                        ])
                    );

                    assert.strictEqual(topNodes.length, 1, 'single root branch');

                    const nodeA = topNodes.at(0);
                    assert.ok(nodeA, 'nodeA must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeA), 'nodeA must be branch');
                    assert.ok(!Hierarchy.Node.isData(nodeA), 'nodeA must not have data');
                    nodePathCheck(nodeA, SCOPE, 'a');

                    const nodeB = Hierarchy.Node.getBranchChildren(nodeA)?.at(0);
                    assert.ok(nodeB, 'nodeB must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeB), 'nodeB must be branch');
                    assert.ok(!Hierarchy.Node.isData(nodeB), 'nodeB must not have data');
                    nodePathCheck(nodeB, SCOPE, 'a', '');
                    assert.strictEqual(Hierarchy.Node.getSegment(nodeB), '');

                    const nodeC = Hierarchy.Node.getBranchChildren(nodeB)?.at(0);
                    assert.ok(nodeC, 'nodeC must exist');
                    assert.ok(!Hierarchy.Node.isBranch(nodeC), 'nodeC must not be branch');
                    assert.ok(Hierarchy.Node.isData(nodeC), 'nodeC must have data');
                    assert.strictEqual(nodeC.tag, 'leaf', 'nodeC must have tag "leaf"');
                    nodePathCheck(nodeC, SCOPE, 'a', '', 'c');

                });


                // Алгоритм защищен от случая когда все сегменты пустые
                test('resolvePath correctly recovers all-empty segments', function () {

                    const segments = ['', '', ''];

                    const topNodes = topNodesToArray(
                        Hierarchy.build([
                            { scope: '', path: segments, data: { tag: 'leaf' } },
                        ]),
                        ''
                    );

                    assert.strictEqual(topNodes.length, 1, 'single root branch');

                    const nodeA = topNodes.at(0);
                    assert.ok(nodeA, 'nodeA must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeA), 'nodeA must be branch');
                    assert.ok(!Hierarchy.Node.isData(nodeA), 'nodeA must not have data');
                    nodePathCheck(nodeA, '', '');

                    const nodeB = Hierarchy.Node.getBranchChildren(nodeA)?.at(0);
                    assert.ok(nodeB, 'nodeB must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeB), 'nodeB must be branch');
                    assert.ok(!Hierarchy.Node.isData(nodeB), 'nodeB must not have data');
                    nodePathCheck(nodeB, '', '', '');
                    assert.strictEqual(Hierarchy.Node.getSegment(nodeB), '');

                    const nodeC = Hierarchy.Node.getBranchChildren(nodeB)?.at(0);
                    assert.ok(nodeC, 'nodeC must exist');
                    assert.ok(!Hierarchy.Node.isBranch(nodeC), 'nodeC must not be branch');
                    assert.ok(Hierarchy.Node.isData(nodeC), 'nodeC must have data');
                    assert.strictEqual(nodeC.tag, 'leaf', 'nodeC must have tag "leaf"');
                    nodePathCheck(nodeC, '', '', '', '');

                });


                // Спецсимволы в сегментах не ломают построение дерева и roundtrip.
                test('resolvePath correctly recovers segments with special characters', function () {

                    const specialSegments = [
                        'hello world',
                        'path/to\\file',
                        'it\'s "fine"',
                        '!@#$%^&*()',
                        'a\tb\nc',
                        'Привіт Світ',
                        '日本語🚀',
                        '   ',
                        '..',
                        '~!@#$%^&*()_+-={}[],.<|>?!№;%:',
                        'a\tb\nc',
                        '\0\x01\x1f\x7f',
                        'a'.repeat(500),
                    ];

                    for (const seg of specialSegments) {

                        const segments = ['normal', seg, 'tail'];

                        const topNodes = topNodesToArray(
                            Hierarchy.build([
                                spec(segments, { tag: 'ok' }),
                            ])
                        );

                        assert.strictEqual(topNodes.length, 1, `"${seg.slice(0, 20)}…": single root`);

                        const nodeA = topNodes.at(0);
                        assert.ok(nodeA, `"${seg.slice(0, 20)}…": nodeA must exist`);
                        assert.ok(Hierarchy.Node.isBranch(nodeA));
                        nodePathCheck(nodeA, SCOPE, ...segments.slice(0, 1));
                        assert.strictEqual(Hierarchy.Node.getSegment(nodeA), 'normal');

                        const nodeB = Hierarchy.Node.getBranchChildren(nodeA)?.at(0);
                        assert.ok(nodeB, `"${seg.slice(0, 20)}…": nodeB must exist`);
                        assert.ok(Hierarchy.Node.isBranch(nodeB));
                        nodePathCheck(nodeB, SCOPE, ...segments.slice(0, 2));
                        assert.strictEqual(
                            Hierarchy.Node.getSegment(nodeB), seg,
                            `getSegment must recover "${seg.slice(0, 30)}…"`
                        );

                        const nodeC = Hierarchy.Node.getBranchChildren(nodeB)?.at(0);
                        assert.ok(nodeC, `"${seg.slice(0, 20)}…": nodeC must exist`);
                        assert.ok(Hierarchy.Node.isData(nodeC));
                        assert.strictEqual(nodeC.tag, 'ok');
                        nodePathCheck(nodeC, SCOPE, ...segments.slice(0, 3));

                    }
                });


                // getBranchChildren возвращает detached-копию — мутация не портит дерево.
                test('getBranchChildren returns a detached copy — mutation does not corrupt tree', function () {
                    const topNodes = topNodesToArray(
                        Hierarchy.build([spec(['a', 'b'], { tag: 'x' })])
                    );
                    const nodeA = topNodes[0];
                    assert.ok(nodeA, 'precondition');
                    assert.ok(Hierarchy.Node.isBranch(nodeA), 'precondition');
                    const children = Hierarchy.Node.getBranchChildren(nodeA);
                    children.length = 0;
                    assert.strictEqual(Hierarchy.Node.getBranchChildren(nodeA).length, 1);
                });

            });

        });


        suite('Lookup', () => {

            // Находит листовой DataNode по полному пути.
            test('finds leaf node by full path', function () {
                const hierarchy = Hierarchy.build([
                    spec(['a', 'b', 'c'], { tag: 'leaf' }),
                ]);
                const found = Hierarchy.lookup(hierarchy, SCOPE, ['a', 'b', 'c']);
                assert.ok(found, 'must find the node');
                assert.ok(Hierarchy.Node.isData(found));
                assert.strictEqual(found.tag, 'leaf');
            });

            // Находит промежуточный (чистый branch) узел.
            test('finds intermediate branch node', function () {
                const hierarchy = Hierarchy.build([
                    spec(['a', 'b', 'c'], { tag: 'deep' }),
                ]);
                const found = Hierarchy.lookup(hierarchy, SCOPE, ['a', 'b']);
                assert.ok(found, 'must find intermediate node');
                assert.ok(Hierarchy.Node.isBranch(found), 'must be branch');
                assert.ok(!Hierarchy.Node.isData(found), 'must not have data');
                assert.strictEqual(Hierarchy.Node.getSegment(found), 'b');
            });

            // Находит узел с двойной ролью (data + branch).
            test('finds data+branch node', function () {
                const hierarchy = Hierarchy.build([
                    spec(['a', 'b'], { tag: 'child' }),
                    spec(['a'], { tag: 'parent' }),
                ]);
                const found = Hierarchy.lookup(hierarchy, SCOPE, ['a']);
                assert.ok(found, 'must find the node');
                assert.ok(Hierarchy.Node.isData(found), 'must have data');
                assert.ok(Hierarchy.Node.isBranch(found), 'must have children');
                assert.strictEqual(found.tag, 'parent');
            });

            suite('Edges', () => {

                // Иерархия заморожена — не мутабельна.
                test('mutation-resistant', function () {
                    const hierarchy = Hierarchy.build([spec(['a', 'b'], { tag: 'x' })]);

                    assert.throws(() => {
                        // @ts-expect-error — проверка runtime-заморозки
                        hierarchy[SCOPE] = null;
                    }, /read only property/);

                    assert.throws(() => {
                        // @ts-expect-error
                        delete hierarchy[SCOPE];
                    }, /Cannot delete property/);

                    assert.throws(() => {
                        // @ts-expect-error
                        hierarchy['xxx'] = null;
                    }, /object is not extensible/);
                });

                // Пустой массив path → undefined.
                test('empty path returns undefined', function () {
                    const hierarchy = Hierarchy.build([spec(['a', 'b'], { tag: 'x' })]);
                    assert.strictEqual(Hierarchy.lookup(hierarchy, SCOPE, []), undefined);
                });

                // Пустая иерархия → undefined.
                test('empty hierarchy returns undefined', function () {
                    const hierarchy = Hierarchy.build([]);
                    assert.strictEqual(Hierarchy.lookup(hierarchy, SCOPE, ['anything']), undefined);
                });

                // Первый сегмент существует, второй — нет → undefined.
                test('partial match returns undefined', function () {
                    const hierarchy = Hierarchy.build([
                        spec(['a', 'b'], { tag: 'x' }),
                    ]);
                    const found = Hierarchy.lookup(hierarchy, SCOPE, ['a', 'nope']);
                    assert.strictEqual(found, undefined);
                });

                // Полностью несуществующий путь → undefined.
                test('non-existent path returns undefined', function () {
                    const hierarchy = Hierarchy.build([
                        spec(['a', 'b'], { tag: 'x' }),
                    ]);
                    const found = Hierarchy.lookup(hierarchy, SCOPE, ['zzz']);
                    assert.strictEqual(found, undefined);
                });

                // Путь длиннее дерева (проходит сквозь лист) → undefined.
                test('path beyond leaf depth returns undefined', function () {
                    const hierarchy = Hierarchy.build([
                        spec(['a'], { tag: 'x' }),
                    ]);
                    assert.ok(hierarchy);
                    const nodeA = Hierarchy.lookup(hierarchy, SCOPE, ['a']);
                    assert.ok(nodeA);
                    assert.ok(!Hierarchy.Node.isBranch(nodeA), 'precondition: leaf has no children');
                    const found = Hierarchy.lookup(hierarchy, SCOPE, ['a', 'ghost']);
                    assert.strictEqual(found, undefined);
                });

            });

        });


        suite('Edges', () => {

            test('all public methods work when destructured (no this-dependency)', function () {

                const {
                    build,
                    lookup,
                    getScope,
                    Node,
                    Scope: ScopeNS
                } = Hierarchy;

                const {
                    getBranchChildren,
                    getParent,
                    getSegment,
                    isBranch,
                    isData,
                    resolvePath,
                } = Node;

                const { getChildren } = ScopeNS;

                assert.doesNotThrow(() => {
                    const hierarchy = build<{}, typeof SCOPE>([
                        spec(['a', 'b', 'c'], {})
                    ]);

                    const scope = getScope(hierarchy, SCOPE);
                    assert.ok(scope);
                    const topChildren = getChildren(scope);
                    const node = topChildren[0];

                    if (isBranch(node)) {
                        getBranchChildren(node);
                        isData(node);
                        getParent(node);
                        getSegment(node);
                        const { scope: s, path: p } = resolvePath(node);
                        lookup(hierarchy, s as typeof SCOPE, p);
                    }
                    else {
                        throw Error;
                    }
                });

            });

        });

    });

});