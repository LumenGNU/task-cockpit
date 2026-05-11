import * as assert from 'assert/strict';
import Hierarchy from '../Cockpit/TreeModel/Hierarchy';


suite('@module Cockpit/Tree/Hierarchy', function () {


    suite('Hierarchy.build', () => {

        // Минимальное дерево: один spec → один корневой DataNode с данными и корректным path.
        test('single segment produces one root DataNode', function () {

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


        // Глубокая цепочка (3 уровня): промежуточные — чистые branch'и, данные только на листе.
        test('chained segments produce nested nodes with data on leaf', function () {

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


        // Порядок children внутри ветки соответствует порядку поступления spec'ов.
        test('children order within a branch follows spec insertion order', function () {

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



        // Порядок children (числовых) внутри ветки соответствует порядку поступления spec'ов.
        test('children order (number) within a branch follows spec insertion order', function () {

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


        // Переиспользование узлов: два spec'а с общим префиксом → один промежуточный trunk.
        test('shared prefix reuses intermediate node', function () {

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

        // Двойная роль: узел одновременно несёт данные и имеет детей.
        test('node can be both data and branch', function () {

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


        // Контракт позиционирования: ветка встаёт на позицию в порядке поступления спецификации.
        test('branch position follows first occurrence', function () {

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
        test('tree shape and data are independent of spec order', function () {

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


        suite('Edges', () => {

            // Тест на пустой ввод.
            test('empty specs produce no root nodes', function () {
                const hierarchy = Hierarchy.build([]);
                assert.strictEqual(Hierarchy.getRoots(hierarchy).length, 0);
            });


            // Семантика перезаписи: последний spec выигрывает.
            test('duplicate path overwrites data', function () {

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
            test('identical to all segments does not collapse the tree', function () {

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
            test('spec with empty segments is silently skipped', function () {

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


            // Защита от регрессии: пустые строки в сегментах не ломают построение и resolvePath.
            test('resolvePath correctly recovers empty segments', function () {

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


            // Защита от регрессии: все сегменты пустые — worst-case для resolvePath.
            test('resolvePath correctly recovers all-empty segments', function () {

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


            // getBranchChildren возвращает detached-копию — мутация не портит дерево.
            test('getBranchChildren returns a detached copy — mutation does not corrupt tree', function () {

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
            test('mutation-resistant', function () {
                const hierarchy = Hierarchy.build([
                    { path: ['a', 'b'], data: { tag: 'x' } }
                ]);

                // проверка runtime-заморозки -- НЕТ
                // ts - предупреждает
                // runtime - ломает
                assert.doesNotThrow(() => {
                    // @ts-expect-error
                    hierarchy['a'] = null;
                });

                assert.doesNotThrow(() => {
                    // @ts-expect-error
                    delete hierarchy['a'];
                });

                assert.doesNotThrow(() => {
                    // @ts-expect-error
                    hierarchy['xxx'] = null;
                });
            });

        });

    });

    suite('Hierarchy.getRoots', () => {

        test('getRoots returns a detached copy — mutation does not corrupt hierarchy', function () {

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


    suite('Node.isData', () => {

        // Чистый лист — isData === true, данные доступны на узле.
        test('true for pure leaf', function () {

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


        // Промежуточный узел — spec ['parent', 'child'] → isData === false.
        test('false for intermediate node', function () {

            const hierarchy = Hierarchy.build([
                { path: ['parent', 'child'], data: { tag: 'x' } }
            ]);

            const roots = Hierarchy.getRoots(hierarchy);
            assert.ok(roots);
            const parent = roots.at(0);
            assert.ok(parent);
            assert.ok(!Hierarchy.Node.isData(parent), 'isData must be false');
        });


        // DataNode с детьми — ['parent'] + ['parent', 'child'] →
        // узел parent — и data, и branch одновременно.
        test('true for data node with children', function () {
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

        suite('DataNode field access', () => {

            // Произвольные поля данных доступны на DataNode как собственные свойства.
            test('data fields accessible on DataNode', function () {

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


            suite('Edges', () => {

                test('data node exposes only payload keys as own enumerable properties', function () {

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


                // Перезапись полностью замещает старый payload: лишние ключи предыдущего spec удаляются.
                test('duplicate path removes stale keys from previous data', function () {

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


    suite('Node.getData', () => {

        // Возвращает чистый payload без структурных полей иерархии.
        test('returns clean payload without structural fields', function () {

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

        // getData на data+branch узле — возвращает payload, не структурные поля.
        test('returns payload for data+branch node', function () {

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

        // Пустой payload → пустой объект.
        test('returns object with no own keys for empty payload', function () {

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

    });


    suite('Node.isBranch', () => {

        // Чистый лист — isBranch === false.
        test('false for pure leaf', function () {

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
        test('true for intermediate node', function () {

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


    suite('Node.getParent', () => {

        // Корневой узел → parent — это null.
        test('returns null for root node', function () {
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

        // Лист возвращает своего непосредственного родителя.
        test('returns immediate parent for leaf', function () {
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

        // Промежуточный узел возвращает своего родителя.
        test('returns parent for intermediate node', function () {
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


    suite('Node.resolvePath', () => {

        // Проверка resolvePath на промежуточном и листовом узлах.
        test('resolvePath encodes segments correctly', function () {

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
        test('child path extends parent path; resolved paths are unique', function () {
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


    suite('Hierarchy.Lookup', () => {

        // Находит листовой DataNode по полному пути.
        test('finds leaf node by full path', function () {
            const hierarchy = Hierarchy.build([
                { path: ['a', 'b', 'c'], data: { tag: 'leaf' } },
            ]);
            const found = Hierarchy.lookup(hierarchy, ['a', 'b', 'c']);
            assert.ok(found, 'must find the node');
            assert.ok(Hierarchy.Node.isData(found));
            assert.strictEqual(found.tag, 'leaf');
        });

        // Находит промежуточный (чистый branch) узел.
        test('finds intermediate branch node', function () {
            const hierarchy = Hierarchy.build([
                { path: ['a', 'b', 'c'], data: { tag: 'deep' } },
            ]);
            const found = Hierarchy.lookup(hierarchy, ['a', 'b']);
            assert.ok(found, 'must find intermediate node');
            assert.ok(Hierarchy.Node.isBranch(found), 'must be branch');
            assert.ok(!Hierarchy.Node.isData(found), 'must not have data');
            assert.strictEqual(Hierarchy.Node.getSegment(found), 'b');
        });

        // Находит узел с двойной ролью (data + branch).
        test('finds data+branch node', function () {
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

        suite('Edges', () => {

            // Пустой массив path → null.
            test('empty path returns null', function () {
                const hierarchy = Hierarchy.build([
                    { path: ['a', 'b'], data: { tag: 'x' } }
                ]);
                assert.strictEqual(Hierarchy.lookup(hierarchy, []), null);
            });

            // Пустая иерархия → null.
            test('empty hierarchy returns null', function () {
                const hierarchy = Hierarchy.build([]);
                assert.strictEqual(Hierarchy.lookup(hierarchy, ['anything']), null);
            });

            // Первый сегмент существует, второй — нет → null.
            test('partial match returns null', function () {
                const hierarchy = Hierarchy.build([
                    { path: ['a', 'b'], data: { tag: 'x' } }
                ]);
                const found = Hierarchy.lookup(hierarchy, ['a', 'nope']);
                assert.strictEqual(found, null);
            });

            // Полностью несуществующий путь → null.
            test('non-existent path returns null', function () {
                const hierarchy = Hierarchy.build([
                    { path: ['a', 'b'], data: { tag: 'x' } }
                ]);
                const found = Hierarchy.lookup(hierarchy, ['zzz']);
                assert.strictEqual(found, null);
            });

            // Путь длиннее дерева (проходит сквозь лист) → null.
            test('path beyond leaf depth returns null', function () {
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


    suite('Hierarchy.walk', () => {

        // Обходит все узлы всех корней, каждый ровно один раз.
        test('visits every node', function () {

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

        // Пустая иерархия → visitor не вызывается.
        test('does not call visitor on empty hierarchy', function () {

            const hierarchy = Hierarchy.build([]);
            let called = false;

            Hierarchy.walk(hierarchy, () => { called = true; });

            assert.ok(!called, 'visitor must not be called');
        });
    });


    suite('Node.walk', () => {

        // Обходит поддерево branch-узла (pre-order), включая сам узел.
        test('visits subtree in pre-order including the node itself', function () {

            const hierarchy = Hierarchy.build([
                { path: ['root', 'a', 'deep'], data: { tag: '1' } },
                { path: ['root', 'b'], data: { tag: '2' } },
                { path: ['root'], data: { tag: '0' } },
                { path: ['outside'], data: { tag: 'x' } },
            ]);

            const roots = Hierarchy.getRoots(hierarchy);


            const rootNode = roots.at(0);
            assert.ok(rootNode, 'precondition');
            assert.ok(Hierarchy.Node.isBranch(rootNode), 'precondition');
            assert.strictEqual(Hierarchy.Node.getSegment(rootNode), 'root', 'precondition');

            const segments: string[] = [];

            Hierarchy.Node.walk(rootNode, (node) => {
                segments.push(Hierarchy.Node.getSegment(node));
            });

            // root, a, deep, b — 4 узла; outside не входит
            assert.strictEqual(segments.length, 4,
                `must visit 4 nodes, got: [${segments}]`);
            assert.ok(!segments.includes('outside'), 'must not visit outside subtree');
            assert.strictEqual(segments[0], 'root', 'must start with the node itself');
            // pre-order: a перед deep
            assert.ok(segments.indexOf('a') < segments.indexOf('deep'));
        });
    });


    suite('API surface', () => {

        test('all public methods work when destructured (no this-dependency)', function () {

            const {
                build,
                getRoots,
                lookup,
                walk,
                Node,
            } = Hierarchy;

            const {
                isData,
                isBranch,
                getSegment,
                getData,
                getParent,
                getBranchChildren,
                resolvePath,
                walk: nodeWalk,
            } = Node;

            const hierarchy = build([
                { path: ['a', 'b', 'c'], data: { tag: 'leaf' } },
                { path: ['a', 'b'], data: { tag: 'mid' } },
                { path: ['a'], data: { tag: 'root' } },
            ]);

            const roots = getRoots(hierarchy);
            assert.strictEqual(roots.length, 1, 'getRoots');

            const nodeA = roots[0]!;
            assert.ok(isBranch(nodeA), 'isBranch');
            assert.ok(isData(nodeA), 'isData');
            assert.strictEqual(getSegment(nodeA), 'a', 'getSegment');
            assert.strictEqual(getData(nodeA).tag, 'root', 'getData');
            assert.strictEqual(getParent(nodeA), null, 'getParent on root');
            assert.deepStrictEqual(resolvePath(nodeA), ['a'], 'resolvePath');

            const nodeB = getBranchChildren(nodeA)[0]!;
            assert.ok(isBranch(nodeB), 'isBranch on mid');
            assert.ok(isData(nodeB), 'isData on mid');
            assert.strictEqual(getParent(nodeB), nodeA, 'getParent');

            const found = lookup(hierarchy, ['a', 'b', 'c']);
            assert.ok(found, 'lookup');
            assert.ok(isData(found), 'isData on lookup result');
            assert.strictEqual(getData(found).tag, 'leaf', 'getData on lookup result');

            const walkedByHierarchy: string[] = [];
            walk(hierarchy, node => walkedByHierarchy.push(getSegment(node)));
            assert.strictEqual(walkedByHierarchy.length, 3, 'walk (hierarchy)');

            const walkedByNode: string[] = [];
            nodeWalk(nodeA, node => walkedByNode.push(getSegment(node)));
            assert.strictEqual(walkedByNode.length, 3, 'walk (node)');
            assert.strictEqual(walkedByNode[0], 'a', 'nodeWalk starts with root');
        });

    });



});