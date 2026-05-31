import * as assert from 'assert/strict';
import Hierarchy from 'src/TreeModel/Hierarchy';

// `${/*N=0*/'000'/**/}`

suite('Cockpit', function () {

    suite('TreeModel', function () {

        suite('Hierarchy', function () {

            suite('build', function () {

                test(`${/*++N*/'001'/**/} минимальное дерево: один spec → один корневой DataNode с данными и корректным path`, function () {

                    const hierarchy = Hierarchy.build([
                        { path: ['leaf'], data: { tag: 'x' } },
                    ]);

                    const roots = Hierarchy.getRoots(hierarchy);
                    assert.ok(roots);

                    assert.strictEqual(roots.length, 1);

                    const leaf = roots.at(0);
                    assert.ok(leaf, 'node must exist');
                    assert.ok(Hierarchy.Node.isData(leaf), 'leaf must be DataNode');
                    assert.ok(!Hierarchy.Node.isBranch(leaf), 'pure leaf must not be branch');
                    assert.strictEqual(leaf.tag, 'x');

                    const resolved = Hierarchy.Node.resolvePath(leaf);
                    assert.deepStrictEqual(resolved, ['leaf']);
                });


                test(`${/*++N*/'002'/**/} глубокая цепочка (3 уровня): промежуточные — чистые branch'и, данные только на листе`, function () {

                    const hierarchy = Hierarchy.build([
                        { path: ['a', 'b', 'c'], data: { tag: 'deep' } },
                    ]);

                    const roots = Hierarchy.getRoots(hierarchy);
                    assert.ok(roots);

                    const nodeA = roots.at(0);
                    assert.ok(nodeA, 'nodeA must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeA), 'nodeA must be branch');
                    assert.ok(!Hierarchy.Node.isData(nodeA), 'nodeA must not have data');
                    const pathA = Hierarchy.Node.resolvePath(nodeA);
                    assert.deepStrictEqual(pathA, ['a']);

                    const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                    assert.ok(nodeB, 'nodeB must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeB), 'nodeB must be branch');
                    assert.ok(!Hierarchy.Node.isData(nodeB), 'nodeB must not have data');
                    const pathB = Hierarchy.Node.resolvePath(nodeB);
                    assert.deepStrictEqual(pathB, ['a', 'b']);

                    const nodeC = Hierarchy.Node.getBranchChildren(nodeB).at(0);
                    assert.ok(nodeC, 'nodeC must exist');
                    assert.ok(!Hierarchy.Node.isBranch(nodeC), 'nodeC must not be branch');
                    assert.ok(Hierarchy.Node.isData(nodeC), 'nodeC must have data');
                    assert.strictEqual(nodeC.tag, 'deep');
                    const pathC = Hierarchy.Node.resolvePath(nodeC);
                    assert.deepStrictEqual(pathC, ['a', 'b', 'c']);
                });


                test(`${/*++N*/'003'/**/} порядок children внутри ветки соответствует порядку поступления spec'ов`, function () {

                    const hierarchy = Hierarchy.build([
                        { path: ['trunk', 'alpha'], data: { tag: 'a' } },
                        { path: ['trunk', 'gamma'], data: { tag: 'g' } },
                        { path: ['trunk', 'beta'], data: { tag: 'b' } },
                    ]);

                    const roots = Hierarchy.getRoots(hierarchy);
                    assert.ok(roots);
                    const trunk = roots.at(0);
                    assert.ok(trunk, 'trunk must exist');
                    assert.ok(Hierarchy.Node.isBranch(trunk));

                    const children = Hierarchy.Node.getBranchChildren(trunk);
                    assert.strictEqual(children.length, 3, 'trunk must have 3 children');

                    assert.strictEqual(Hierarchy.Node.getSegment(children[0]!), 'alpha');
                    assert.strictEqual(Hierarchy.Node.getSegment(children[1]!), 'gamma');
                    assert.strictEqual(Hierarchy.Node.getSegment(children[2]!), 'beta');

                    // Обратная проверка: другой порядок spec'ов → другой порядок children.
                    const hierarchy2 = Hierarchy.build([
                        { path: ['trunk', 'beta'], data: { tag: 'b' } },
                        { path: ['trunk', 'alpha'], data: { tag: 'a' } },
                        { path: ['trunk', 'gamma'], data: { tag: 'g' } },
                    ]);

                    const roots2 = Hierarchy.getRoots(hierarchy2);
                    assert.ok(roots2);
                    const trunk2 = roots2.at(0);
                    assert.ok(trunk2, 'trunk2 must exist');
                    assert.ok(Hierarchy.Node.isBranch(trunk2));

                    const children2 = Hierarchy.Node.getBranchChildren(trunk2);
                    assert.strictEqual(children2.length, 3, 'trunk2 must have 3 children');

                    assert.strictEqual(Hierarchy.Node.getSegment(children2[0]!), 'beta');
                    assert.strictEqual(Hierarchy.Node.getSegment(children2[1]!), 'alpha');
                    assert.strictEqual(Hierarchy.Node.getSegment(children2[2]!), 'gamma');
                });


                test(`${/*++N*/'004'/**/} порядок children (числовых) внутри ветки соответствует порядку поступления spec'ов`, function () {

                    const hierarchy = Hierarchy.build([
                        { path: ['trunk', '3'], data: { tag: 'a' } },
                        { path: ['trunk', '1'], data: { tag: 'g' } },
                        { path: ['trunk', '2'], data: { tag: 'b' } },
                    ]);

                    const roots = Hierarchy.getRoots(hierarchy);
                    assert.ok(roots);
                    const trunk = roots.at(0);
                    assert.ok(trunk, 'trunk must exist');
                    assert.ok(Hierarchy.Node.isBranch(trunk));

                    const children = Hierarchy.Node.getBranchChildren(trunk);
                    assert.strictEqual(children.length, 3, 'trunk must have 3 children');

                    assert.strictEqual(Hierarchy.Node.getSegment(children[0]!), '3');
                    assert.strictEqual(Hierarchy.Node.getSegment(children[1]!), '1');
                    assert.strictEqual(Hierarchy.Node.getSegment(children[2]!), '2');

                    // Обратная проверка: другой порядок spec'ов → другой порядок children.
                    const hierarchy2 = Hierarchy.build([
                        { path: ['trunk', '2'], data: { tag: 'b' } },
                        { path: ['trunk', '3'], data: { tag: 'a' } },
                        { path: ['trunk', '1'], data: { tag: 'g' } },
                    ]);

                    const roots2 = Hierarchy.getRoots(hierarchy2);
                    assert.ok(roots2);
                    const trunk2 = roots2.at(0);
                    assert.ok(trunk2, 'trunk2 must exist');
                    assert.ok(Hierarchy.Node.isBranch(trunk2));

                    const children2 = Hierarchy.Node.getBranchChildren(trunk2);
                    assert.strictEqual(children2.length, 3, 'trunk2 must have 3 children');

                    assert.strictEqual(Hierarchy.Node.getSegment(children2[0]!), '2');
                    assert.strictEqual(Hierarchy.Node.getSegment(children2[1]!), '3');
                    assert.strictEqual(Hierarchy.Node.getSegment(children2[2]!), '1');
                });


                test(`${/*++N*/'005'/**/} переиспользование узлов: два spec'а с общим префиксом → один промежуточный trunk`, function () {

                    const hierarchy = Hierarchy.build([
                        { path: ['trunk', 'left'], data: { tag: 'L' } },
                        { path: ['trunk', 'right'], data: { tag: 'R' } },
                    ]);

                    const roots = Hierarchy.getRoots(hierarchy);
                    assert.ok(roots);

                    assert.strictEqual(roots.length, 1, 'shared trunk = one root');

                    const trunk = roots.at(0);
                    assert.ok(trunk, 'trunk must exist');
                    assert.ok(!Hierarchy.Node.isData(trunk), 'trunk is pure intermediate');
                    assert.ok(Hierarchy.Node.isBranch(trunk));

                    const children = Hierarchy.Node.getBranchChildren(trunk);
                    assert.strictEqual(children.length, 2, 'trunk has two children');

                    const left = children.at(0);
                    assert.ok(left, 'left must exist');
                    assert.strictEqual(Hierarchy.Node.getSegment(left), 'left');
                    assert.ok(Hierarchy.Node.isData(left));
                    assert.strictEqual(left.tag, 'L');

                    const right = children.at(1);
                    assert.ok(right, 'right must exist');
                    assert.strictEqual(Hierarchy.Node.getSegment(right), 'right');
                    assert.ok(Hierarchy.Node.isData(right));
                    assert.strictEqual(right.tag, 'R');
                });


                test(`${/*++N*/'006'/**/} двойная роль: узел одновременно несёт данные и имеет детей`, function () {

                    // Узлы a и b несут данные, и имеют ребенка.
                    // Узел c конечный — не имеет детей, только данные.
                    const hierarchy = Hierarchy.build([
                        { path: ['a', 'b', 'c'], data: { tag: 'c-data' } },
                        { path: ['a', 'b'], data: { tag: 'b-data' } },
                        { path: ['a'], data: { tag: 'a-data' } },
                    ]);

                    const roots = Hierarchy.getRoots(hierarchy);
                    assert.ok(roots);

                    assert.strictEqual(roots.length, 1);

                    const nodeA = roots.at(0);
                    assert.ok(nodeA, 'nodeA must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeA), 'nodeA must be branch');
                    assert.ok(Hierarchy.Node.isData(nodeA), 'nodeA must have data');
                    assert.strictEqual(nodeA.tag, 'a-data');
                    const pathA = Hierarchy.Node.resolvePath(nodeA);
                    assert.deepStrictEqual(pathA, ['a']);

                    const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                    assert.ok(nodeB, 'nodeB must exist');
                    assert.ok(Hierarchy.Node.isBranch(nodeB), 'nodeB must be branch');
                    assert.ok(Hierarchy.Node.isData(nodeB), 'nodeB must have data');
                    assert.strictEqual(nodeB.tag, 'b-data');
                    const pathB = Hierarchy.Node.resolvePath(nodeB);
                    assert.deepStrictEqual(pathB, ['a', 'b']);

                    const nodeC = Hierarchy.Node.getBranchChildren(nodeB).at(0);
                    assert.ok(nodeC, 'nodeC must exist');
                    assert.ok(!Hierarchy.Node.isBranch(nodeC), 'nodeC must not be branch');
                    assert.ok(Hierarchy.Node.isData(nodeC), 'nodeC must have data');
                    assert.strictEqual(nodeC.tag, 'c-data');
                    const pathC = Hierarchy.Node.resolvePath(nodeC);
                    assert.deepStrictEqual(pathC, ['a', 'b', 'c']);
                });


                test(`${/*++N*/'007'/**/} контракт позиционирования: ветка встаёт на позицию в порядке поступления спецификации`, function () {

                    const specs = [
                        { path: ['x'], data: { tag: 'x' } },
                        { path: ['y'], data: { tag: 'y' } },
                        { path: ['z'], data: { tag: 'z' } },
                    ];

                    const names = ['x', 'y', 'z'] as const;

                    // все шесть перестановок
                    for (const [i, j, k] of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {

                        const hierarchy = Hierarchy.build([
                            specs[i!]!,
                            specs[j!]!,
                            specs[k!]!
                        ]);
                        const label = `permutation ${names[i!]}, ${names[j!]}, ${names[k!]}`;

                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots, `${label}: roots must exist`);

                        assert.strictEqual(roots.length, 3, `${label}: must have 3 roots`);

                        assert.strictEqual(Hierarchy.Node.getSegment(roots[0]!), names[i!], `${label}: [0]`);
                        assert.strictEqual(Hierarchy.Node.getSegment(roots[1]!), names[j!], `${label}: [1]`);
                        assert.strictEqual(Hierarchy.Node.getSegment(roots[2]!), names[k!], `${label}: [2]`);
                    }
                });


                // Структурный инвариант:
                // Дерево определяется только набором путей, а не тем в каком порядке поступают спецификации.
                // Например, ['a', 'b', 'c'] может прийти раньше ['a'] — и алгоритм должен корректно доклеить 
                // data к уже существующему чистому branch.
                test(`${/*++N*/'008'/**/} дерево определяется только набором путей, а не тем в каком порядке поступают спецификации`, function () {

                    const specs = [
                        { path: ['a'], data: { tag: '1' } },
                        { path: ['a', 'b'], data: { tag: '2' } },
                        { path: ['a', 'b', 'c'], data: { tag: '3' } },
                    ];

                    const expected = Hierarchy.build([specs[0]!, specs[1]!, specs[2]!]);

                    // Проверка образца
                    const roots = Hierarchy.getRoots(expected);
                    assert.ok(roots);

                    assert.strictEqual(roots.length, 1);

                    const a = roots.at(0);
                    assert.ok(a);
                    assert.ok(Hierarchy.Node.isData(a));
                    assert.strictEqual(a.tag, '1');

                    assert.ok(Hierarchy.Node.isBranch(a));
                    const b = Hierarchy.Node.getBranchChildren(a).at(0);
                    assert.ok(b);
                    assert.ok(Hierarchy.Node.isData(b));
                    assert.strictEqual(b.tag, '2');

                    assert.ok(Hierarchy.Node.isBranch(b));
                    const c = Hierarchy.Node.getBranchChildren(b).at(0);
                    assert.ok(c);
                    assert.ok(Hierarchy.Node.isData(c));
                    assert.strictEqual(c.tag, '3');

                    // Все оставшиеся перестановки дают ту же структуру
                    for (const [i, j, k] of [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
                        const result = Hierarchy.build([
                            specs[i!]!,
                            specs[j!]!,
                            specs[k!]!
                        ]);
                        // Каждая перестановка порождает структуру сходную с образцом
                        assert.deepStrictEqual(result, expected, `must match in permutation [${i},${j},${k}]`);
                    }
                });


                suite('Edges', function () {

                    // Тест на пустой ввод.
                    test(`${/*++N*/'009'/**/} пустой ввод — пустой результат`, function () {
                        const hierarchy = Hierarchy.build([]);
                        assert.strictEqual(Hierarchy.getRoots(hierarchy).length, 0);
                    });


                    // Семантика перезаписи: последний spec выигрывает.
                    test(`${/*++N*/'010'/**/} семантика перезаписи: последний spec выигрывает`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['target'], data: { tag: 'original' } },
                            { path: ['target'], data: { tag: 'replacement' } },
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots);


                        assert.strictEqual(roots.length, 1, 'only one');

                        const node = roots[0];
                        assert.ok(node, 'must exist');
                        assert.ok(Hierarchy.Node.isData(node), 'must remain DataNode');
                        assert.strictEqual(node.tag, 'replacement', 'later spec wins');
                    });


                    // Граничный случай: segment на всех уровнях.
                    test(`${/*++N*/'011'/**/} граничный случай: segment на всех уровнях`, function () {

                        const V = 'same';

                        const hierarchy = Hierarchy.build([
                            { path: [V, V, V], data: { tag: 'leaf' } },
                            { path: [V], data: { tag: 'root-data' } },
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots);

                        assert.strictEqual(roots.length, 1, 'single root branch');

                        const root = roots.at(0);
                        assert.ok(root, 'root must exist');
                        assert.strictEqual(Hierarchy.Node.getSegment(root), V);
                        assert.ok(Hierarchy.Node.isData(root), 'root must carry data');
                        assert.ok(Hierarchy.Node.isBranch(root), 'root must be branch');
                        assert.strictEqual(root.tag, 'root-data');
                        const rootPath = Hierarchy.Node.resolvePath(root);
                        assert.deepStrictEqual(rootPath, [V]);

                        const midChildren = Hierarchy.Node.getBranchChildren(root);
                        assert.strictEqual(midChildren.length, 1);
                        const mid = midChildren.at(0);
                        assert.ok(mid, 'mid must exist');
                        assert.strictEqual(Hierarchy.Node.getSegment(mid), V);
                        assert.ok(!Hierarchy.Node.isData(mid), 'intermediate must not have data');
                        assert.ok(Hierarchy.Node.isBranch(mid), 'intermediate must be branch');
                        const midPath = Hierarchy.Node.resolvePath(mid);
                        assert.deepStrictEqual(midPath, [V, V]);

                        const leafChildren = Hierarchy.Node.getBranchChildren(mid);
                        assert.strictEqual(leafChildren.length, 1);
                        const leaf = leafChildren.at(0);
                        assert.ok(leaf, 'leaf must exist');
                        assert.strictEqual(Hierarchy.Node.getSegment(leaf), V);
                        assert.ok(Hierarchy.Node.isData(leaf), 'leaf must have data');
                        assert.strictEqual(leaf.tag, 'leaf');
                        assert.ok(!Hierarchy.Node.isBranch(leaf), 'leaf must not be branch');
                        const leafPath = Hierarchy.Node.resolvePath(leaf);
                        assert.deepStrictEqual(leafPath, [V, V, V]);
                    });


                    // Спецификация с пустым массивом сегментов — молча игнорируется.
                    test(`${/*++N*/'012'/**/} спецификация с пустым массивом сегментов`, function () {

                        const empty = { path: [] as string[], data: { tag: 'ghost' } };
                        const x = { path: ['X'], data: { tag: 'X' } };
                        const z = { path: ['Z'], data: { tag: 'Z' } };

                        for (const [a, b, c] of [[empty, x, z], [x, empty, z], [x, z, empty]]) {

                            const hierarchy = Hierarchy.build([a!, b!, c!]);

                            const roots = Hierarchy.getRoots(hierarchy);
                            assert.ok(roots);

                            assert.strictEqual(roots.length, 2, 'empty-path spec must not produce a node');

                            // Оба валидных узла выжили
                            const tags = roots.map(c => {
                                assert.ok(Hierarchy.Node.isData(c));
                                return c.tag;
                            });
                            assert.ok(tags.includes('X'), 'X must survive');
                            assert.ok(tags.includes('Z'), 'Z must survive');
                        }
                    });


                    test(`${/*++N*/'013'/**/} защита от регрессии: пустые строки в сегментах не ломают построение и resolvePath`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['a', '', 'c'], data: { tag: 'leaf' } },
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots);

                        assert.strictEqual(roots.length, 1);

                        const nodeA = roots.at(0);
                        assert.ok(nodeA, 'nodeA must exist');
                        assert.ok(Hierarchy.Node.isBranch(nodeA));
                        assert.ok(!Hierarchy.Node.isData(nodeA));
                        const pathA = Hierarchy.Node.resolvePath(nodeA);
                        assert.deepStrictEqual(pathA, ['a']);

                        const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                        assert.ok(nodeB, 'nodeB must exist');
                        assert.ok(Hierarchy.Node.isBranch(nodeB));
                        assert.ok(!Hierarchy.Node.isData(nodeB));
                        assert.strictEqual(Hierarchy.Node.getSegment(nodeB), '');
                        const pathB = Hierarchy.Node.resolvePath(nodeB);
                        assert.deepStrictEqual(pathB, ['a', '']);

                        const nodeC = Hierarchy.Node.getBranchChildren(nodeB).at(0);
                        assert.ok(nodeC, 'nodeC must exist');
                        assert.ok(!Hierarchy.Node.isBranch(nodeC));
                        assert.ok(Hierarchy.Node.isData(nodeC));
                        assert.strictEqual(nodeC.tag, 'leaf');
                        const pathC = Hierarchy.Node.resolvePath(nodeC);
                        assert.deepStrictEqual(pathC, ['a', '', 'c']);
                    });


                    test(`${/*++N*/'014'/**/} защита от регрессии: все сегменты пустые — worst-case для resolvePath`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['', '', ''], data: { tag: 'leaf' } },
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots);

                        assert.strictEqual(roots.length, 1);

                        const nodeA = roots.at(0);
                        assert.ok(nodeA, 'nodeA must exist');
                        assert.ok(Hierarchy.Node.isBranch(nodeA));
                        assert.ok(!Hierarchy.Node.isData(nodeA));
                        const pathA = Hierarchy.Node.resolvePath(nodeA);
                        assert.deepStrictEqual(pathA, ['']);

                        const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                        assert.ok(nodeB, 'nodeB must exist');
                        assert.ok(Hierarchy.Node.isBranch(nodeB));
                        assert.ok(!Hierarchy.Node.isData(nodeB));
                        const pathB = Hierarchy.Node.resolvePath(nodeB);
                        assert.deepStrictEqual(pathB, ['', '']);

                        const nodeC = Hierarchy.Node.getBranchChildren(nodeB).at(0);
                        assert.ok(nodeC, 'nodeC must exist');
                        assert.ok(!Hierarchy.Node.isBranch(nodeC));
                        assert.ok(Hierarchy.Node.isData(nodeC));
                        assert.strictEqual(nodeC.tag, 'leaf');
                        const pathC = Hierarchy.Node.resolvePath(nodeC);
                        assert.deepStrictEqual(pathC, ['', '', '']);
                    });


                    // Спецсимволы в сегментах не ломают построение дерева и roundtrip.
                    // Защита от регрессии: спецсимволы в сегментах не ломают построение дерева и roundtrip.
                    test(`${/*++N*/'015'/**/} защита от регрессии: спецсимволы в сегментах`, function () {

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
                            '\0\x01\x1f\x7f',
                            'a'.repeat(500),
                        ];

                        for (const seg of specialSegments) {

                            const label = `"${seg.slice(0, 20)}…"`;

                            const hierarchy = Hierarchy.build([
                                { path: ['normal', seg, 'tail'], data: { tag: 'ok' } },
                            ]);

                            const roots = Hierarchy.getRoots(hierarchy);
                            assert.ok(roots, `${label}: roots must exist`);

                            assert.strictEqual(roots.length, 1, `${label}: single root`);

                            const nodeA = roots.at(0);
                            assert.ok(nodeA, `${label}: nodeA must exist`);
                            assert.ok(Hierarchy.Node.isBranch(nodeA));
                            assert.strictEqual(Hierarchy.Node.getSegment(nodeA), 'normal');
                            const pathA = Hierarchy.Node.resolvePath(nodeA);
                            assert.deepStrictEqual(pathA, ['normal']);

                            const nodeB = Hierarchy.Node.getBranchChildren(nodeA).at(0);
                            assert.ok(nodeB, `${label}: nodeB must exist`);
                            assert.ok(Hierarchy.Node.isBranch(nodeB));
                            assert.strictEqual(Hierarchy.Node.getSegment(nodeB), seg, `${label}: getSegment must recover segment`);
                            const pathB = Hierarchy.Node.resolvePath(nodeB);
                            assert.deepStrictEqual(pathB, ['normal', seg]);

                            const nodeC = Hierarchy.Node.getBranchChildren(nodeB).at(0);
                            assert.ok(nodeC, `${label}: nodeC must exist`);
                            assert.ok(Hierarchy.Node.isData(nodeC));
                            assert.strictEqual(nodeC.tag, 'ok');
                            const pathC = Hierarchy.Node.resolvePath(nodeC);
                            assert.deepStrictEqual(pathC, ['normal', seg, 'tail']);
                        }
                    });

                    // @todo getBranchChildren
                    // getBranchChildren возвращает detached-копию — мутация не портит дерево.
                    test(`${/*++N*/'016'/**/} getBranchChildren returns a detached copy — mutation does not corrupt tree`, function () {

                        const hierarchy = Hierarchy.build([
                            { path: ['a', 'b'], data: { tag: 'x' } },
                        ]);

                        const roots = Hierarchy.getRoots(hierarchy);
                        assert.ok(roots);
                        const nodeA = roots.at(0);
                        assert.ok(nodeA, 'precondition');
                        assert.ok(Hierarchy.Node.isBranch(nodeA), 'precondition');
                        const children1 = Hierarchy.Node.getBranchChildren(nodeA);
                        assert.strictEqual(children1.length, 1);

                        Hierarchy.Node.getBranchChildren(nodeA).length = 0;

                        const children2 = Hierarchy.Node.getBranchChildren(nodeA);
                        assert.strictEqual(children2.length, 1);

                        assert.deepStrictEqual(children1, children2);
                    });


                    // Тест не проверяет runtime-заморозку (её нет).
                    // @­ts-expect-error подтверждает, что tsc отвергает мутации на уровне типов.
                    test.skip(`${/*++N*/'017'/**/} mutation-resistant`, function () {
                        const hierarchy = Hierarchy.build([
                            { path: ['a', 'b'], data: { tag: 'x' } }
                        ]);

                        // проверка runtime-заморозки -- НЕТ
                        // ts - предупреждает
                        // runtime - ломает
                        assert.doesNotThrow(function () {
                            // @ts-expect-error
                            hierarchy['a'] = null;
                        });

                        assert.doesNotThrow(function () {
                            // @ts-expect-error
                            delete hierarchy['a'];
                        });

                        assert.doesNotThrow(function () {
                            // @ts-expect-error
                            hierarchy['xxx'] = null;
                        });
                    });

                });

            });

        });

    });

});
