import * as assert from 'assert/strict';
import Builder from '../Cockpit/Tree/Builder';


type PLoad = { tag: string; };


const SCOPE = '<S-id>';




function spec<D extends object = PLoad>(segments: ReadonlyArray<string>, data: D): Builder.Spec<D> {
    return { segments, data };
}


function nodePathCheck(node: Builder.Node<PLoad, string>, expectScopeId: string, ...expectSegments: string[]): void {

    const { scopeId, segments } = Builder.Node.resolvePath(node);

    assert.strictEqual(scopeId, expectScopeId, 'scopeId must match');
    assert.deepStrictEqual(segments, expectSegments, 'segments must match');
}


suite('@module Cockpit/Tree/Builder', function () {

    suite('build', () => {

        suite('Node.isData', () => {

            // Чистый лист — isData === true, данные доступны на узле.
            test('true for pure leaf', function () {
                const topNodes = Builder.build(SCOPE, [spec(['leaf'], { tag: 'x' })]);
                const leaf = topNodes.at(0);
                assert.ok(leaf);
                assert.ok(Builder.Node.isData(leaf), 'isData must be true');
                assert.strictEqual(leaf.tag, 'x', 'data must be present');
            });


            // Промежуточный узел — spec ['parent', 'child'] → isData === false.
            test('false for intermediate node', function () {
                const topNodes = Builder.build(SCOPE, [spec(['parent', 'child'], { tag: 'x' })]);
                const parent = topNodes.at(0);
                assert.ok(parent);
                assert.ok(!Builder.Node.isData(parent), 'isData must be false');
            });


            // DataNode с детьми — ['parent'] + ['parent', 'child'] →
            // узел parent — и data, и branch одновременно.
            test('true for data node with children', function () {
                const topNodes = Builder.build(SCOPE, [
                    spec(['parent', 'child'], { tag: 'child' }),
                    spec(['parent'], { tag: 'parent data' }),
                ]);
                const parent = topNodes.at(0);
                assert.ok(parent);
                assert.ok(Builder.Node.isBranch(parent));
                assert.ok(Builder.Node.isData(parent));
                assert.strictEqual(parent.tag, 'parent data', 'data must be present');
            });

        });


        suite('Node.isBranch', () => {

            // Чистый лист — поле children отсутствует вообще (деталь реализации); isBranch === false.
            test('false for pure leaf', function () {
                const topNodes = Builder.build(SCOPE, [spec(['leaf'], { tag: 'x' })]);
                const leaf = topNodes.at(0);
                assert.ok(leaf);
                assert.ok(!('children' in leaf), 'children must not be present');
                assert.ok(!Builder.Node.isBranch(leaf), 'isBranch must be false');
            });


            // Промежуточный узел — spec ['parent', 'child'] → isBranch === true.
            test('true for intermediate node', function () {
                const topNodes = Builder.build(SCOPE, [spec(['parent', 'child'], { tag: 'x' })]);
                const parent = topNodes.at(0);
                assert.ok(parent);
                assert.ok(Builder.Node.isBranch(parent), 'isBranch must be true');
            });

        });


        suite('Node.getParent', () => {

            // Корневой узел → undefined.
            test('returns undefined for root node', function () {

                const topNodes = Builder.build(SCOPE, [
                    spec(['a', 'b'], { tag: 'x' }),
                ]);
                const root = topNodes[0];
                assert.ok(root, 'precondition');
                assert.strictEqual(Builder.Node.getParent(root), undefined);
            });

            // Лист возвращает своего непосредственного родителя.
            test('returns immediate parent for leaf', function () {
                const topNodes = Builder.build(SCOPE, [
                    spec(['a', 'b'], { tag: 'leaf' }),
                ]);
                const parent = topNodes[0];
                assert.ok(parent, 'precondition');
                assert.ok(Builder.Node.isBranch(parent));
                const leaf = Builder.Node.getBranchChildren(parent).at(0);
                assert.ok(leaf, 'precondition');
                assert.ok(Builder.Node.isData(leaf));
                assert.strictEqual(Builder.Node.getParent(leaf), parent);
            });

            // Промежуточный узел возвращает своего родителя.
            test('returns parent for intermediate node', function () {
                const topNodes = Builder.build(SCOPE, [
                    spec(['a', 'b', 'c'], { tag: 'deep' }),
                ]);
                const nodeA = topNodes[0];
                assert.ok(nodeA, 'precondition');
                assert.ok(Builder.Node.isBranch(nodeA));
                const nodeB = Builder.Node.getBranchChildren(nodeA).at(0);
                assert.ok(nodeB, 'precondition');
                assert.ok(Builder.Node.isBranch(nodeB));
                assert.strictEqual(Builder.Node.getParent(nodeB), nodeA);
            });

        });


        suite('parsePath', () => {

            // Проверка формата nodePath на промежуточном и листовом узлах.
            // spec ['parent', 'child'] с scope "S":
            // промежуточный → "S{SEP}parent", лист → "S{SEP}parent{SEP}child".
            test('nodePath encodes scope and segments correctly', function () {

                const topNodes = Builder.build(SCOPE, [
                    spec(['parent', 'child'], { tag: 'x' }),
                ]);

                assert.strictEqual(topNodes.length, 1);

                const parent = topNodes.at(0);
                assert.ok(parent, 'must exist');
                nodePathCheck(parent, SCOPE, 'parent');
                assert.ok(Builder.Node.isBranch(parent));
                const child = Builder.Node.getBranchChildren(parent)?.at(0);
                assert.ok(child, 'must exist');
                nodePathCheck(child, SCOPE, 'parent', 'child');
            });


            // Разные scope → разные nodePath для одинаковых segments.
            test('different scopes produce different nodePaths', function () {

                const treeA = Builder.build('scope-A', [spec(['node'], { tag: 'a' })]);
                const treeB = Builder.build('scope-B', [spec(['node'], { tag: 'b' })]);

                const nodeA = treeA.at(0);
                assert.ok(nodeA);
                nodePathCheck(nodeA, 'scope-A', 'node');
                assert.ok(Builder.Node.isData(nodeA));
                assert.strictEqual(nodeA.tag, 'a');

                const nodeB = treeB.at(0);
                assert.ok(nodeB);
                nodePathCheck(nodeB, 'scope-B', 'node');
                assert.ok(Builder.Node.isData(nodeB));
                assert.strictEqual(nodeB.tag, 'b');

            });


            // Структурный инвариант: parsePath(child) = parent.segments + segment.
            // nodePath уникален в пределах дерева.
            test('child segments extend parent segments; nodePaths are unique', function () {

                const s1 = ['a', 'b', 'c'];
                const s2 = ['a', 'b', 'd'];
                const s3 = ['a'];
                const s4 = ['x', 'y'];

                const topNodes = Builder.build(SCOPE, [
                    spec(s1, { tag: '1' }),
                    spec(s2, { tag: '2' }),
                    spec(s3, { tag: '3' }),
                    spec(s4, { tag: '4' }),
                ]);

                const seen = new Set<string>();

                function walk(parent: Builder.Node<PLoad, string> | null, node: Builder.Node<PLoad, string>): void {


                    const np = Builder.Node.resolvePath(node);

                    const nodePath = [np.scopeId, ...np.segments].join('\0-\0-\0')

                    // uniqueness
                    assert.ok(
                        !seen.has(nodePath),
                        `duplicate nodePath: "${nodePath}"`
                    );
                    seen.add(nodePath);

                    // structural: child.segments = [...parent.segments, segment]
                    if (parent) {
                        const parentParsed = Builder.Node.resolvePath(parent);
                        const childParsed = Builder.Node.resolvePath(node);
                        assert.strictEqual(childParsed.scopeId, parentParsed.scopeId);

                        assert.deepStrictEqual(
                            childParsed.segments.slice(0, -1),
                            parentParsed.segments,
                            `child segments must extend parent segments`
                        );

                        assert.strictEqual(
                            Builder.Node.getSegment(node),
                            childParsed.segments.at(-1)
                        );
                    }

                    if (Builder.Node.isBranch(node)) {
                        for (const child of Builder.Node.getBranchChildren(node)!) {
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
                const topNodes = Builder.build(SCOPE, [
                    { segments: ['leaf'], data: { label: 'hello', priority: 1, hole: null, empty: undefined, dtt: new Date() } },
                ]);
                const leaf = topNodes.at(0);
                assert.ok(leaf, 'must exist');
                assert.ok(Builder.Node.isData(leaf));
                assert.strictEqual(leaf.label, 'hello');
                assert.strictEqual(leaf.priority, 1);
                assert.strictEqual(leaf.hole, null);
                assert.strictEqual(leaf.empty, undefined);
                assert.ok(leaf.dtt instanceof Date);
            });


            suite('Edges', () => {

                test('data node exposes only payload keys as own enumerable properties', function () {

                    const topNodes = Builder.build(SCOPE, [
                        spec(['solo'], {}),
                    ]);
                    const node = topNodes.at(0);
                    assert.ok(node, 'node must exist');
                    assert.ok(Builder.Node.isData(node));

                    assert.deepStrictEqual(
                        Object.keys(node),
                        [],
                        `Empty payload must produce zero own enumerable keys, got: ${JSON.stringify(Object.keys(node))}`
                    );
                });


                // Перезапись полностью замещает старый payload: лишние ключи предыдущего spec удаляются.
                test('duplicate path removes stale keys from previous data', function () {
                    const topNodes = Builder.build<{ tag: string, extra?: any }, typeof SCOPE>(SCOPE, [
                        { segments: ['target'], data: { tag: 'old', extra: 42 } },
                        { segments: ['target'], data: { tag: 'new' } },
                    ]);

                    assert.strictEqual(topNodes.length, 1);
                    const node = topNodes[0];
                    assert.ok(node, 'precondition');
                    assert.ok(Builder.Node.isData(node));
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

            // Минимальное дерево: один spec → один корневой DataNode с данными и корректным nodePath.
            // Один spec ['only'] → один корневой DataNode с данными и правильным nodePath.
            test('single segment produces one root DataNode', function () {

                const segments = ['leaf'];
                const topNodes = Builder.build(SCOPE, [spec(segments, { tag: 'x' })]);

                const leaf = topNodes.at(0);
                assert.ok(leaf, 'leaf must exist');
                assert.ok(Builder.Node.isData(leaf), 'leaf must be DataNode');
                assert.ok(!Builder.Node.isBranch(leaf), 'pure leaf must not be branch');
                assert.strictEqual(leaf.tag, 'x');

                nodePathCheck(leaf, SCOPE, ...segments);
            });


            // Глубокая цепочка (3 уровня): промежуточные — чистые branch'и, данные только на листе.
            // из трёх узлов. Только лист содержит данные. Промежуточные — чистые branch'и.
            test('chained segments produce nested nodes with data on leaf', function () {

                const segments = ['a', 'b', 'c'];

                const topNodes = Builder.build(SCOPE, [
                    spec(segments, { tag: 'deep' }),
                ]);

                assert.strictEqual(topNodes.length, 1);

                const nodeA = topNodes.at(0);
                assert.ok(nodeA, 'nodeA must exist');
                assert.ok(Builder.Node.isBranch(nodeA), 'nodeA must be branch');
                assert.ok(!Builder.Node.isData(nodeA), 'nodeA must not have data');

                nodePathCheck(nodeA, SCOPE, ...segments.slice(0, 1));

                const nodeB = Builder.Node.getBranchChildren(nodeA)?.at(0);
                assert.ok(nodeB, 'nodeB must exist');
                assert.ok(Builder.Node.isBranch(nodeB), 'nodeB must be branch');
                assert.ok(!Builder.Node.isData(nodeB), 'nodeB must not have data');

                nodePathCheck(nodeB, SCOPE, ...segments.slice(0, 2));

                const nodeC = Builder.Node.getBranchChildren(nodeB)?.at(0);
                assert.ok(nodeC, 'nodeC must exist');
                assert.ok(!Builder.Node.isBranch(nodeC), 'nodeC must not be branch');
                assert.ok(Builder.Node.isData(nodeC), 'nodeC must have data');
                assert.strictEqual(nodeC.tag, 'deep', 'nodeC must have tag "deep"');
                nodePathCheck(nodeC, SCOPE, ...segments.slice(0, 3));
            });


            // Порядок children внутри ветки соответствует порядку поступления spec'ов.
            test('children order within a branch follows spec insertion order', function () {

                const topNodes = Builder.build(SCOPE, [
                    spec(['trunk', 'alpha'], { tag: 'a' }),
                    spec(['trunk', 'gamma'], { tag: 'g' }),
                    spec(['trunk', 'beta'], { tag: 'b' }),
                ]);

                assert.strictEqual(topNodes.length, 1);
                const trunk = topNodes[0];
                assert.ok(trunk, 'precondition');
                assert.ok(Builder.Node.isBranch(trunk));

                const children = Builder.Node.getBranchChildren(trunk)!;
                assert.strictEqual(children.length, 3, 'trunk must have 3 children');

                assert.strictEqual(Builder.Node.getSegment(children[0]), 'alpha');
                assert.strictEqual(Builder.Node.getSegment(children[1]), 'gamma');
                assert.strictEqual(Builder.Node.getSegment(children[2]), 'beta');
            });


            // Переиспользование узлов: два spec'а с общим префиксом → один промежуточный trunk.
            // Общий префикс — два spec'а ['trunk', 'left'] и ['trunk', 'right'] → один
            // промежуточный trunk с двумя детьми. Проверяет переиспользование узлов.
            test('shared prefix reuses intermediate node', function () {

                const branchL = spec(['trunk', 'left'], { tag: 'L' });
                const branchR = spec(['trunk', 'right'], { tag: 'R' });

                const topNodes = Builder.build(SCOPE, [
                    branchL,
                    branchR
                ]);

                assert.strictEqual(topNodes.length, 1, 'shared trunk = one root');

                const trunk = topNodes.at(0);
                assert.ok(trunk, 'trunk must exist');

                assert.ok(!Builder.Node.isData(trunk), 'trunk is pure intermediate');

                assert.ok(Builder.Node.isBranch(trunk));

                assert.strictEqual(Builder.Node.getBranchChildren(trunk)?.length, 2, 'trunk has two children');

                const left = Builder.Node.getBranchChildren(trunk)?.at(0);
                const right = Builder.Node.getBranchChildren(trunk)?.at(1);

                assert.ok(left, 'left must exist');
                assert.strictEqual(Builder.Node.getSegment(left), 'left', 'left must have segment "left"');
                assert.ok(Builder.Node.isData(left), 'left must be DataNode');
                assert.strictEqual(left.tag, 'L', 'left must have tag "L"');

                assert.ok(right, 'right must exist');
                assert.strictEqual(Builder.Node.getSegment(right), 'right', 'right must have segment "right"');
                assert.ok(Builder.Node.isData(right), 'right must be DataNode');
                assert.strictEqual(right.tag, 'R', 'right must have tag "R"');

            });


            // Двойная роль: узел одновременно несёт данные и имеет детей. Реализация не затирает children.
            // ['parent', 'child'] создаёт parent как промежуточный, затем ['parent']
            // добавляет данные — children не должны затереться.
            test('node can be both data and branch', function () {

                const topNodes = Builder.build(SCOPE, [
                    spec(['a', 'b', 'c'], { tag: 'c-data' }),
                    spec(['a', 'b'], { tag: 'b-data' }),
                    spec(['a'], { tag: 'a-data' }),
                ]);

                assert.strictEqual(topNodes.length, 1);

                const nodeA = topNodes.at(0);
                assert.ok(nodeA, 'nodeA must exist');
                assert.ok(Builder.Node.isBranch(nodeA), 'nodeA must be branch');
                assert.ok(Builder.Node.isData(nodeA), 'nodeA must have data');
                assert.strictEqual(nodeA.tag, 'a-data', 'nodeA must have tag "a-data"');
                nodePathCheck(nodeA, SCOPE, 'a');

                const nodeB = Builder.Node.getBranchChildren(nodeA)?.at(0);
                assert.ok(nodeB, 'nodeB must exist');
                assert.ok(Builder.Node.isBranch(nodeB), 'nodeB must be branch');
                assert.ok(Builder.Node.isData(nodeB), 'nodeB must have data');
                assert.strictEqual(nodeB.tag, 'b-data', 'nodeB must have tag "b-data"');
                nodePathCheck(nodeB, SCOPE, 'a', 'b');

                const nodeC = Builder.Node.getBranchChildren(nodeB)?.at(0);
                assert.ok(nodeC, 'nodeC must exist');
                assert.ok(!Builder.Node.isBranch(nodeC), 'nodeC must not be branch');
                assert.ok(Builder.Node.isData(nodeC), 'nodeC must have data');
                assert.strictEqual(nodeC.tag, 'c-data', 'nodeC must have tag "c-data"');
                nodePathCheck(nodeC, SCOPE, 'a', 'b', 'c');
            });


            // Контракт позиционирования: ветка встаёт на позицию в порядке поступления спецификации.
            // ['early'] идёт первой → в children корня сначала early, потом late.
            test('branch position follows first occurrence', function () {

                const x = spec(['x'], { tag: 'x' });
                const y = spec(['y'], { tag: 'y' });
                const z = spec(['z'], { tag: 'z' });

                const items = [x, y, z];
                const names = ['x', 'y', 'z'];

                // все шесть перестановок
                for (const [i, j, k] of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {

                    const result = Builder.build(SCOPE, [items[i], items[j], items[k]]);

                    // Быстрая проверка
                    assert.strictEqual(result.length, 3);
                    assert.strictEqual((result[0] as any).tag, names[i], `[0] in permutation ${names[i]}, ${names[j]}, ${names[k]} must be ${names[i]}`);
                    assert.strictEqual((result[1] as any).tag, names[j], `[1] in permutation ${names[i]}, ${names[j]}, ${names[k]} must be ${names[j]}`);
                    assert.strictEqual((result[2] as any).tag, names[k], `[2] in permutation ${names[i]}, ${names[j]}, ${names[k]} must be ${names[k]}`);
                }

            });


            // Структурный инвариант:
            // Дерево определяется только набором путей, а не процессом их накопления.
            // Порядок внутри веток гарантирован спецификацией.
            // [['parent', 'child', 'grandchild'], ['parent', 'child']]
            // и наоборот — дают структурно идентичные деревья.
            test('spec order does not affect tree structure', function () {

                const root = spec(['a'], { tag: '1' });
                const shallow = spec(['a', 'b'], { tag: '2' });
                const deep = spec(['a', 'b', 'c'], { tag: '3' });

                const items = [root, deep, shallow];
                const names = ['root', 'deep', 'shallow'];

                const expected = Builder.build(SCOPE, [items[0], items[1], items[2]]);

                // Быстрая проверка образца на "правильность"
                assert.strictEqual(expected.length, 1);


                const a1 = expected[0];
                assert.ok(Builder.Node.isData(a1));
                assert.strictEqual(a1.tag, '1', 'a - tag must match');

                assert.ok(Builder.Node.isBranch(a1));
                const b2 = Builder.Node.getBranchChildren(a1)![0];
                assert.ok(Builder.Node.isData(b2));
                assert.strictEqual(b2.tag, '2', 'b - tag must match');
                assert.ok(Builder.Node.isBranch(b2));
                const c3 = Builder.Node.getBranchChildren(b2)![0];
                assert.ok(Builder.Node.isData(c3));
                assert.strictEqual(c3.tag, '3', 'c - tag must match');

                // все 5 перестановок
                for (const [i, j, k] of [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
                    const result = Builder.build(SCOPE, [items[i], items[j], items[k]]);
                    assert.deepStrictEqual(result, expected, `expected must match in permutation ${names[i]}, ${names[j]}, ${names[k]}`);
                }

            });


            suite('Edges', () => {

                // Тест на пустой ввод:
                // Что произойдет, если передать пустой массив specs ?.
                test('empty specs produce no root nodes', function () {
                    const topNodes = Builder.build(SCOPE, []);
                    assert.ok(Array.isArray(topNodes), 'must return an array');
                    assert.strictEqual(topNodes.length, 0);
                });


                // Семантика перезаписи: последний spec выигрывает. (тихо в prod-сборке).
                // Последний выигрывает (overwrite). Покрывает ветку warning-лога.
                test('duplicate path overwrites data', function () {

                    const topNodes = Builder.build(SCOPE, [
                        spec(['target'], { tag: 'original' }),
                        spec(['target'], { tag: 'replacement' }),
                    ]);

                    assert.strictEqual(topNodes.length, 1);

                    const node = topNodes.at(0);
                    assert.ok(node, 'must exist');
                    assert.ok(Builder.Node.isData(node), 'must remain DataNode');
                    assert.strictEqual(node.tag, 'replacement', 'later spec wins');
                });


                // Граничный случай: scopeId === segment на всех уровнях → дерево нормально строится, не схлопывается.
                test('scopeId identical to all segments does not collapse the tree', function () {
                    const V = 'same';
                    const topNodes = Builder.build(V, [
                        spec([V, V, V], { tag: 'leaf' }),
                        spec([V], { tag: 'root-data' }),
                    ]);

                    assert.strictEqual(topNodes.length, 1, 'single root branch');

                    const root = topNodes.at(0);
                    assert.ok(root, 'must exist');
                    assert.strictEqual(Builder.Node.getSegment(root), V);
                    nodePathCheck(root, V, V);
                    assert.ok(Builder.Node.isData(root), 'root must carry data');
                    assert.ok(Builder.Node.isBranch(root), 'root must be branch');
                    assert.strictEqual(root.tag, 'root-data');

                    assert.strictEqual(Builder.Node.getBranchChildren(root)?.length, 1);
                    const mid = Builder.Node.getBranchChildren(root)?.at(0);
                    assert.ok(mid, 'must exist');
                    assert.strictEqual(Builder.Node.getSegment(mid), V);
                    nodePathCheck(mid, V, V, V);
                    assert.ok(!Builder.Node.isData(mid), 'intermediate must not have data');
                    assert.ok(Builder.Node.isBranch(mid), 'intermediate must be branch');

                    assert.strictEqual(Builder.Node.getBranchChildren(mid)?.length, 1);
                    const leaf = Builder.Node.getBranchChildren(mid)?.at(0);
                    assert.ok(leaf, 'must exist');
                    assert.strictEqual(Builder.Node.getSegment(leaf), V);
                    nodePathCheck(leaf, V, V, V, V);
                    assert.ok(Builder.Node.isData(leaf), 'leaf must have data');
                    assert.strictEqual(leaf.tag, 'leaf');
                    assert.ok(!Builder.Node.isBranch(leaf), 'leaf must not be branch');
                });


                // Спецификация с пустым массивом сегментов — молча игнорируется, не ломает остальные.
                // Спецификация с пустым массивом сегментов — молча игнорируется, не ломает остальные.
                test('spec with empty segments is silently skipped', function () {

                    const items = [
                        /*0*/ { // Без особого места жительства
                            // нет ручек — нет конфеток
                            segments: [],
                            data: { tag: 'y' }
                        },
                        /*1*/ { // Всегда первый
                            segments: ['X'],
                            data: { tag: 'X' }
                        },
                        /*2*/ { // Всегда второй
                            segments: ['Z'],
                            data: { tag: 'Z' }
                        },
                    ];

                    for (const [i, j, k] of [[0, 1, 2], [1, 0, 2], [1, 2, 0]]) {

                        const p = `permutation [${i},${j},${k}]`;
                        const topNodes = Builder.build(SCOPE, [items[i], items[j], items[k]]);

                        // assert.ok(Array.isArray(topNodes), `${p}: must return an array`);
                        assert.strictEqual(topNodes.length, 2, `${p}: spec with empty segments must not produce a node`);

                        const first = topNodes.at(0);
                        assert.ok(first, `${p}: first must exist`);
                        nodePathCheck(first, SCOPE, 'X');
                        assert.ok(Builder.Node.isData(first), `${p}: first must be DataNode`);
                        assert.ok(!Builder.Node.isBranch(first), `${p}: first must not be branch`);
                        assert.strictEqual(first.tag, 'X', `${p}: first tag must match`);

                        const second = topNodes.at(1);
                        assert.ok(second, `${p}: second must exist`);
                        nodePathCheck(second, SCOPE, 'Z');
                        assert.ok(Builder.Node.isData(second), `${p}: second must be DataNode`);
                        assert.ok(!Builder.Node.isBranch(second), `${p}: second must not be branch`);
                        assert.strictEqual(second.tag, 'Z', `${p}: second tag must match`);
                    }
                });


                // Алгоритм защищен от пустого scopeId, и КОРРЕКТНО с ним работает
                test('parsePath correctly recovers empty scopeId', function () {

                    const segments = ['a', 'b', 'c'];
                    const emptyScopeId = '';

                    const topNodes = Builder.build(emptyScopeId, [
                        spec(segments, { tag: 'leaf' }),
                    ]);

                    assert.strictEqual(topNodes.length, 1, 'single root branch');

                    const nodeA = topNodes.at(0);
                    assert.ok(nodeA, 'nodeA must exist');
                    assert.ok(Builder.Node.isBranch(nodeA), 'nodeA must be branch');
                    assert.ok(!Builder.Node.isData(nodeA), 'nodeA must not have data');
                    nodePathCheck(nodeA, emptyScopeId, ...segments.slice(0, 1));

                    const nodeB = Builder.Node.getBranchChildren(nodeA)?.at(0);
                    assert.ok(nodeB, 'nodeB must exist');
                    assert.ok(Builder.Node.isBranch(nodeB), 'nodeB must be branch');
                    assert.ok(!Builder.Node.isData(nodeB), 'nodeB must not have data');
                    nodePathCheck(nodeB, emptyScopeId, ...segments.slice(0, 2));

                    const nodeC = Builder.Node.getBranchChildren(nodeB)?.at(0);
                    assert.ok(nodeC, 'nodeC must exist');
                    assert.ok(!Builder.Node.isBranch(nodeC), 'nodeC must not be branch');
                    assert.ok(Builder.Node.isData(nodeC), 'nodeC must have data');
                    assert.strictEqual(nodeC.tag, 'leaf', 'nodeC must have tag "leaf"');
                    nodePathCheck(nodeC, emptyScopeId, ...segments.slice(0, 3));

                });


                // Алгоритм защищен от сегментов, состоящих из пустых строк
                test('parsePath correctly recovers empty segments', function () {

                    const segments = ['a', '', 'c'];

                    const topNodes = Builder.build(SCOPE, [
                        spec(segments, { tag: 'leaf' }),
                    ]);

                    assert.strictEqual(topNodes.length, 1, 'single root branch');

                    const nodeA = topNodes.at(0);
                    assert.ok(nodeA, 'nodeA must exist');
                    assert.ok(Builder.Node.isBranch(nodeA), 'nodeA must be branch');
                    assert.ok(!Builder.Node.isData(nodeA), 'nodeA must not have data');
                    nodePathCheck(nodeA, SCOPE, 'a');

                    const nodeB = Builder.Node.getBranchChildren(nodeA)?.at(0);
                    assert.ok(nodeB, 'nodeB must exist');
                    assert.ok(Builder.Node.isBranch(nodeB), 'nodeB must be branch');
                    assert.ok(!Builder.Node.isData(nodeB), 'nodeB must not have data');
                    nodePathCheck(nodeB, SCOPE, 'a', '');
                    assert.strictEqual(Builder.Node.getSegment(nodeB), '');

                    const nodeC = Builder.Node.getBranchChildren(nodeB)?.at(0);
                    assert.ok(nodeC, 'nodeC must exist');
                    assert.ok(!Builder.Node.isBranch(nodeC), 'nodeC must not be branch');
                    assert.ok(Builder.Node.isData(nodeC), 'nodeC must have data');
                    assert.strictEqual(nodeC.tag, 'leaf', 'nodeC must have tag "leaf"');
                    nodePathCheck(nodeC, SCOPE, 'a', '', 'c');

                });


                // Алгоритм защищен от случая когда все сегменты пустые
                test('parsePath correctly recovers empty segments', function () {

                    const segments = ['', '', ''];

                    const topNodes = Builder.build('', [
                        spec(segments, { tag: 'leaf' }),
                    ]);

                    assert.strictEqual(topNodes.length, 1, 'single root branch');

                    const nodeA = topNodes.at(0);
                    assert.ok(nodeA, 'nodeA must exist');
                    assert.ok(Builder.Node.isBranch(nodeA), 'nodeA must be branch');
                    assert.ok(!Builder.Node.isData(nodeA), 'nodeA must not have data');
                    nodePathCheck(nodeA, '', '');

                    const nodeB = Builder.Node.getBranchChildren(nodeA)?.at(0);
                    assert.ok(nodeB, 'nodeB must exist');
                    assert.ok(Builder.Node.isBranch(nodeB), 'nodeB must be branch');
                    assert.ok(!Builder.Node.isData(nodeB), 'nodeB must not have data');
                    nodePathCheck(nodeB, '', '', '');
                    assert.strictEqual(Builder.Node.getSegment(nodeB), '');

                    const nodeC = Builder.Node.getBranchChildren(nodeB)?.at(0);
                    assert.ok(nodeC, 'nodeC must exist');
                    assert.ok(!Builder.Node.isBranch(nodeC), 'nodeC must not be branch');
                    assert.ok(Builder.Node.isData(nodeC), 'nodeC must have data');
                    assert.strictEqual(nodeC.tag, 'leaf', 'nodeC must have tag "leaf"');
                    nodePathCheck(nodeC, '', '', '', '');

                });


                // Спецсимволы в сегментах не ломают построение дерева и roundtrip.
                test('parsePath correctly recovers segments with special characters', function () {

                    const specialSegments = [
                        'hello world',             // пробелы
                        'path/to\\file',           // слэши
                        'it\'s "fine"',            // кавычки
                        '!@#$%^&*()',              // пунктуация
                        'a\tb\nc',                 // управляющие: tab, newline
                        'Привіт Світ',            // кириллица
                        '日本語🚀',                // CJK + emoji
                        '   ',                     // только пробелы
                        '..',                      // точки (path-like)
                        '~!@#$%^&*()_+-={}[],.<|>?!№;%:',
                        'a\tb\nc',                 // управляющие: tab, newline
                        '\0\x01\x1f\x7f',         // управляющие: NUL, SOH, US, DEL
                        'a'.repeat(500),           // длинная строка
                    ];

                    for (const seg of specialSegments) {

                        const segments = ['normal', seg, 'tail'];

                        const topNodes = Builder.build(SCOPE, [
                            spec(segments, { tag: 'ok' }),
                        ]);

                        assert.strictEqual(topNodes.length, 1, `"${seg.slice(0, 20)}…": single root`);

                        const nodeA = topNodes.at(0);
                        assert.ok(nodeA, `"${seg.slice(0, 20)}…": nodeA must exist`);
                        assert.ok(Builder.Node.isBranch(nodeA));
                        nodePathCheck(nodeA, SCOPE, ...segments.slice(0, 1));
                        assert.strictEqual(Builder.Node.getSegment(nodeA), 'normal');

                        const nodeB = Builder.Node.getBranchChildren(nodeA)?.at(0);
                        assert.ok(nodeB, `"${seg.slice(0, 20)}…": nodeB must exist`);
                        assert.ok(Builder.Node.isBranch(nodeB));
                        nodePathCheck(nodeB, SCOPE, ...segments.slice(0, 2));
                        assert.strictEqual(
                            Builder.Node.getSegment(nodeB), seg,
                            `decodeSegment must recover "${seg.slice(0, 30)}…"`
                        );

                        const nodeC = Builder.Node.getBranchChildren(nodeB)?.at(0);
                        assert.ok(nodeC, `"${seg.slice(0, 20)}…": nodeC must exist`);
                        assert.ok(Builder.Node.isData(nodeC));
                        assert.strictEqual(nodeC.tag, 'ok');
                        nodePathCheck(nodeC, SCOPE, ...segments.slice(0, 3));

                    }
                });


                // build возвращает замороженный массив — прямая мутация length бросает.
                test('build result is frozen — length mutation throws', function () {
                    const nopNodes = Builder.build(SCOPE, [spec(['a', 'b'], { tag: 'x' })]);
                    assert.throws(() => {
                        // @ts-expect-error типы запрещают
                        nopNodes.length = 0;
                    }, /read only property 'length'/);
                });


                // getBranchChildren возвращает detached-копию — мутация не портит дерево.
                test('getBranchChildren returns a detached copy — mutation does not corrupt tree', function () {
                    const nopNodes = Builder.build(SCOPE, [spec(['a', 'b'], { tag: 'x' })]);
                    const nodeA = nopNodes[0];
                    assert.ok(nodeA, 'precondition');
                    assert.ok(Builder.Node.isBranch(nodeA), 'precondition');
                    const children = Builder.Node.getBranchChildren(nodeA);
                    children.length = 0;
                    assert.strictEqual(Builder.Node.getBranchChildren(nodeA).length, 1);
                });

            });

        });


        suite('Lookup', () => {

            // Находит листовой DataNode по полному пути.
            test('finds leaf node by full path', function () {
                const topNodes = Builder.build(SCOPE, [
                    spec(['a', 'b', 'c'], { tag: 'leaf' }),
                ]);
                const found = Builder.lookup(topNodes, ['a', 'b', 'c']);
                assert.ok(found, 'must find the node');
                assert.ok(Builder.Node.isData(found));
                assert.strictEqual(found.tag, 'leaf');
            });

            // Находит промежуточный (чистый branch) узел.
            test('finds intermediate branch node', function () {
                const topNodes = Builder.build(SCOPE, [
                    spec(['a', 'b', 'c'], { tag: 'deep' }),
                ]);
                const found = Builder.lookup(topNodes, ['a', 'b']);
                assert.ok(found, 'must find intermediate node');
                assert.ok(Builder.Node.isBranch(found), 'must be branch');
                assert.ok(!Builder.Node.isData(found), 'must not have data');
                assert.strictEqual(Builder.Node.getSegment(found), 'b');
            });

            // Находит узел с двойной ролью (data + branch).
            test('finds data+branch node', function () {
                const topNodes = Builder.build(SCOPE, [
                    spec(['a', 'b'], { tag: 'child' }),
                    spec(['a'], { tag: 'parent' }),
                ]);
                const found = Builder.lookup(topNodes, ['a']);
                assert.ok(found, 'must find the node');
                assert.ok(Builder.Node.isData(found), 'must have data');
                assert.ok(Builder.Node.isBranch(found), 'must have children');
                assert.strictEqual(found.tag, 'parent');
            });

            // Roundtrip: resolvePath → lookup возвращает тот же узел (===).
            test('roundtrip: resolvePath segments fed back into lookup return the same node', function () {
                const topNodes = Builder.build(SCOPE, [
                    spec(['a', 'b', 'c'], { tag: '1' }),
                    spec(['a', 'b'], { tag: '2' }),
                    spec(['x'], { tag: '3' }),
                ]);

                function walk(node: Builder.Node<PLoad, string>): void {
                    const { segments } = Builder.Node.resolvePath(node);
                    const found = Builder.lookup(topNodes, segments);

                    assert.strictEqual(found, node, `roundtrip failed for path "${segments.join(' • ')}"`);

                    if (Builder.Node.isBranch(node)) {
                        for (const child of Builder.Node.getBranchChildren(node)!) {
                            walk(child);
                        }
                    }
                }

                for (const root of topNodes) {
                    walk(root);
                }
            });

            suite('Edges', () => {

                // lookup отвергает массив, потерявший бренд NodeArrayType.
                test('rejects spread copy of topNodes at type level', function () {
                    const topNodes = Builder.build(SCOPE, [spec(['a', 'b'], { tag: 'x' })]);
                    // @ts-expect-error откажется работать с массивом, если не создавал его сам (spread-копия)
                    assert.ok(Builder.lookup([...topNodes], ['a']), 'сработает, но tsc не пропускает');
                });

                // Пустой массив segments → undefined.
                test('empty segments returns undefined', function () {
                    const topNodes = Builder.build(SCOPE, [spec(['a', 'b'], { tag: 'x' })]);
                    assert.strictEqual(Builder.lookup(topNodes, []), undefined);
                });

                // Пустой массив topNodes → undefined.
                test('empty topNodes returns undefined', function () {
                    const topNodes = Builder.build(SCOPE, []);
                    assert.strictEqual(topNodes.length, 0, 'precondition: no topNodes');
                    assert.strictEqual(Builder.lookup(topNodes, ['anything']), undefined);
                });

                // Первый сегмент существует, второй — нет → undefined.
                test('partial match returns undefined', function () {
                    const topNodes = Builder.build(SCOPE, [
                        spec(['a', 'b'], { tag: 'x' }),
                    ]);
                    const found = Builder.lookup(topNodes, ['a', 'nope']);
                    assert.strictEqual(found, undefined);
                });

                // Полностью несуществующий путь → undefined.
                test('non-existent path returns undefined', function () {
                    const topNodes = Builder.build(SCOPE, [
                        spec(['a', 'b'], { tag: 'x' }),
                    ]);
                    const found = Builder.lookup(topNodes, ['zzz']);
                    assert.strictEqual(found, undefined);
                });

                // Путь длиннее дерева (проходит сквозь лист) → undefined.
                test('path beyond leaf depth returns undefined', function () {
                    const topNodes = Builder.build(SCOPE, [
                        spec(['a'], { tag: 'x' }),
                    ]);
                    assert.ok(!Builder.Node.isBranch(topNodes[0]), 'precondition: leaf has no children');
                    const found = Builder.lookup(topNodes, ['a', 'ghost']);
                    assert.strictEqual(found, undefined);
                });

            });

        });


        suite('Edges', () => {

            test('all public methods work when destructured (no this-dependency)', function () {

                const {
                    getNodeChildren,
                    build,
                    lookup,
                    Node
                } = Builder;

                const {
                    getBranchChildren,
                    getParent,
                    getSegment,
                    isBranch,
                    isData,
                    resolvePath
                } = Node;

                assert.doesNotThrow(() => {
                    const topNodes = build<{}, string>(SCOPE, [
                        spec(['a', 'b', 'c'], {})
                    ]);

                    assert.strictEqual(topNodes.length, 1);
                    const node = topNodes[0];

                    const nodeB = getNodeChildren(node)[0];
                    if (isBranch(nodeB)) {
                        getBranchChildren(nodeB);
                        isData(nodeB);
                        getParent(nodeB);
                        getSegment(nodeB);
                        const { scopeId, segments: segmentsB } = resolvePath(nodeB);
                        lookup(topNodes, segmentsB);
                    }
                    else {
                        throw Error
                    }
                });

            });

        });

    });

});