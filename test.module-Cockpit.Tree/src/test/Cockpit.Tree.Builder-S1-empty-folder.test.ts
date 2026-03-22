import * as assert from 'assert/strict';
import Builder from '../Cockpit/Tree/Builder';


type D = { tag: string; };


const SCOPE = '<S-id>';


function spec(segments: ReadonlyArray<string>, data: D): Builder.SpecType<D> {
    return { segments, data };
}


function nodePathCheck(node: Builder.Node<D, string>, expectScopeId: string, ...expectSegments: string[]): void {

    const { scopeId, segments } = Builder.parsePath(node);

    assert.strictEqual(scopeId, expectScopeId, 'scopeId must match');
    assert.deepStrictEqual(segments, expectSegments, 'segments must match');
}


suite('@module Cockpit/Tree/Builder', function () {


    setup(function () {

    });

    teardown(function () {

    });

    suite('build', () => {

        suite('SEPARATOR', () => {

            // SEPARATOR — внутренний разделитель nodePath.
            // Инвариант безопасности: разделитель — не-вводимый C0-символ, 
            // не \t/\n/\r. Защита от коллизий с пользовательским вводом.
            test('SEPARATOR is a non-input control character', function () {

                assert.strictEqual(typeof Builder.SEPARATOR, 'string', 'must be string');
                assert.ok(Builder.SEPARATOR.length > 0, 'must not be empty');
                assert.strictEqual(Builder.SEPARATOR.length, 1, 'must be single character');

                const code = Builder.SEPARATOR.charCodeAt(0);

                // C0 control characters (U+0000–U+001F) не вводимы с клавиатуры
                // и не допускаются в JSONC-строках как литералы.
                assert.ok(
                    code >= 0x00 && code <= 0x1F,
                    `must be C0 control character, got U+${code.toString(16).padStart(4, '0')}`
                );

                // \t (0x09), \n (0x0A), \r (0x0D) — допустимы через escape в JSON-строках.
                // SUB (0x1A) — используется алгоритмом как замена пустого сегмента - попадает в nodePath.
                assert.ok(
                    ![0x09, 0x0A, 0x0D, 0x1A].includes(code),
                    'must not be tab/LF/CR (representable in JSON via escapes) or SUB (used as empty segment substitute)'
                );
            });
        });


        suite('Node.isData', () => {

            // Чистый лист — isData === true, данные доступны на узле.
            test('true for pure leaf', function () {
                const roots = Builder.build(SCOPE, [spec(['leaf'], { tag: 'x' })]);
                const leaf = roots.at(0);
                assert.ok(leaf);
                assert.ok(Builder.Node.isData(leaf), 'isData must be true');
                assert.strictEqual(leaf.tag, 'x', 'data must be present');
            });


            // Промежуточный узел — spec ['parent', 'child'] → isData === false.
            test('false for intermediate node', function () {
                const roots = Builder.build(SCOPE, [spec(['parent', 'child'], { tag: 'x' })]);
                const parent = roots.at(0);
                assert.ok(parent);
                assert.ok(!Builder.Node.isData(parent), 'isData must be false');
            });


            // DataNode с детьми — ['parent'] + ['parent', 'child'] →
            // узел parent — и data, и branch одновременно.
            test('true for data node with children', function () {
                const roots = Builder.build(SCOPE, [
                    spec(['parent', 'child'], { tag: 'child' }),
                    spec(['parent'], { tag: 'parent data' }),
                ]);
                const parent = roots.at(0);
                assert.ok(parent);
                assert.ok(Builder.Node.isBranch(parent));
                assert.ok(Builder.Node.isData(parent));
                assert.strictEqual(parent.tag, 'parent data', 'data must be present');
            });

        });


        suite('Node.isBranch', () => {

            // Чистый лист — поле children отсутствует вообще (деталь реализации); isBranch === false.
            test('false for pure leaf', function () {
                const roots = Builder.build(SCOPE, [spec(['leaf'], { tag: 'x' })]);
                const leaf = roots.at(0);
                assert.ok(leaf);
                assert.ok(!('children' in leaf), 'children must not be present');
                assert.ok(!Builder.Node.isBranch(leaf), 'isBranch must be false');
            });


            // Промежуточный узел — spec ['parent', 'child'] → isBranch === true.
            test('true for intermediate node', function () {
                const roots = Builder.build(SCOPE, [spec(['parent', 'child'], { tag: 'x' })]);
                const parent = roots.at(0);
                assert.ok(parent);
                assert.ok(Builder.Node.isBranch(parent), 'isBranch must be true');
            });

        });


        suite('parsePath', () => {

            // Проверка формата nodePath на промежуточном и листовом узлах.
            // spec ['parent', 'child'] с scope "S":
            // промежуточный → "S{SEP}parent", лист → "S{SEP}parent{SEP}child".
            test('nodePath encodes scope and segments correctly', function () {

                const roots = Builder.build(SCOPE, [
                    spec(['parent', 'child'], { tag: 'x' }),
                ]);

                assert.strictEqual(roots.length, 1);

                const parent = roots.at(0);
                assert.ok(parent, 'must exist');
                nodePathCheck(parent, SCOPE, 'parent');

                const child = parent.children?.at(0);
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


            // Рекурсивная проверка структурного инварианта: 
            // child.nodePath всегда, у всех нод начинается с parent.nodePath + SEPARATOR.
            test('child nodePath starts with parent nodePath', function () {
                const roots = Builder.build(SCOPE, [
                    spec(['a', 'b', 'c'], { tag: '1' }),
                    spec(['a', 'b', 'd'], { tag: '2' }),
                    spec(['a'], { tag: '3' }),
                    spec(['x', 'y'], { tag: '4' }),
                ]);

                function assertPrefix(parent: Builder.Node<D, string>): void {
                    if (Builder.Node.isBranch(parent)) {
                        for (const child of parent.children!) {
                            assert.ok(
                                child.nodePath.startsWith(parent.nodePath + Builder.SEPARATOR),
                                `child "${child.nodePath}" must start with parent "${parent.nodePath}\{SEPARATOR}"`
                            );
                            assertPrefix(child);
                        }
                    }
                }

                assert.ok(roots.length > 0, 'precondition: tree is not empty');
                for (const root of roots) {
                    assert.ok(
                        root.nodePath.startsWith(SCOPE + Builder.SEPARATOR),
                        `root "${root.nodePath}" must start with scope "${SCOPE}\{SEPARATOR}"`
                    );
                    assertPrefix(root);
                }
            });

        });


        suite('Data Properties', () => {

            // Произвольные поля данных доступны на DataNode как собственные свойства.
            test('data fields accessible on DataNode', function () {
                const roots = Builder.build(SCOPE, [
                    { segments: ['leaf'], data: { label: 'hello', priority: 1, hole: null, empty: undefined, dtt: new Date() } },
                ]);
                const leaf = roots.at(0);
                assert.ok(leaf, 'must exist');
                assert.ok(Builder.Node.isData(leaf));
                assert.strictEqual(leaf.label, 'hello');
                assert.strictEqual(leaf.priority, 1);
                assert.strictEqual(leaf.hole, null);
                assert.strictEqual(leaf.empty, undefined);
                assert.ok(leaf.dtt instanceof Date);
            });


            suite('Edges', () => {

                // Runtime не защищает от коллизии ключей data с 'segment'|'nodePath'|'children'.
                // Типизация отсекает это на уровне компиляции.
                // Если защиту обойти — алгоритм затрёт служебные поля.
                test('runtime is not protected from data key collisions (types enforce this)', function () {

                    const roots = Builder.build(SCOPE, [
                        {
                            segments: ['target'],
                            data: {
                                tag: 'ok',
                                // @ts-expect-error
                                _segment: 'evil',
                                // @ts-expect-error
                                children: 'evil',
                                // @ts-expect-error
                                nodePath: 'evil',
                            }
                        },
                    ]);

                    const node = roots.at(0);
                    assert.ok(node, 'must exist');

                    assert.strictEqual(Builder.Node.decodeSegment(node), 'evil', 'The implementation overwrites the structural fields');
                    assert.strictEqual(node.children, 'evil', 'The implementation overwrites the structural fields');
                    assert.strictEqual(node.nodePath, 'evil', 'The implementation overwrites the structural fields');
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
                const roots = Builder.build(SCOPE, [spec(segments, { tag: 'x' })]);

                const leaf = roots.at(0);
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

                const roots = Builder.build(SCOPE, [
                    spec(segments, { tag: 'deep' }),
                ]);

                assert.strictEqual(roots.length, 1);

                const nodeA = roots.at(0);
                assert.ok(nodeA, 'nodeA must exist');
                assert.ok(Builder.Node.isBranch(nodeA), 'nodeA must be branch');
                assert.ok(!Builder.Node.isData(nodeA), 'nodeA must not have data');

                nodePathCheck(nodeA, SCOPE, ...segments.slice(0, 1));

                const nodeB = nodeA.children.at(0);
                assert.ok(nodeB, 'nodeB must exist');
                assert.ok(Builder.Node.isBranch(nodeB), 'nodeB must be branch');
                assert.ok(!Builder.Node.isData(nodeB), 'nodeB must not have data');

                nodePathCheck(nodeB, SCOPE, ...segments.slice(0, 2));

                const nodeC = nodeB.children.at(0);
                assert.ok(nodeC, 'nodeC must exist');
                assert.ok(!Builder.Node.isBranch(nodeC), 'nodeC must not be branch');
                assert.ok(Builder.Node.isData(nodeC), 'nodeC must have data');
                assert.strictEqual(nodeC.tag, 'deep', 'nodeC must have tag "deep"');
                nodePathCheck(nodeC, SCOPE, ...segments.slice(0, 3));
            });


            // Переиспользование узлов: два spec'а с общим префиксом → один промежуточный trunk.
            // Общий префикс — два spec'а ['trunk', 'left'] и ['trunk', 'right'] → один
            // промежуточный trunk с двумя детьми. Проверяет переиспользование узлов.
            test('shared prefix reuses intermediate node', function () {

                const branchL = spec(['trunk', 'left'], { tag: 'L' });
                const branchR = spec(['trunk', 'right'], { tag: 'R' });

                const roots = Builder.build(SCOPE, [
                    branchL,
                    branchR
                ]);

                assert.strictEqual(roots.length, 1, 'shared trunk = one root');

                const trunk = roots.at(0);
                assert.ok(trunk, 'trunk must exist');

                assert.ok(!Builder.Node.isData(trunk), 'trunk is pure intermediate');
                assert.strictEqual(trunk.children.length, 2, 'trunk has two children');

                const left = trunk.children.at(0);
                const right = trunk.children.at(1);

                assert.ok(left, 'left must exist');
                assert.strictEqual(Builder.Node.decodeSegment(left), 'left', 'left must have segment "left"');
                assert.ok(Builder.Node.isData(left), 'left must be DataNode');
                assert.strictEqual(left.tag, 'L', 'left must have tag "L"');

                assert.ok(right, 'right must exist');
                assert.strictEqual(Builder.Node.decodeSegment(right), 'right', 'right must have segment "right"');
                assert.ok(Builder.Node.isData(right), 'right must be DataNode');
                assert.strictEqual(right.tag, 'R', 'right must have tag "R"');

            });


            // Двойная роль: узел одновременно несёт данные и имеет детей. Реализация не затирает children.
            // ['parent', 'child'] создаёт parent как промежуточный, затем ['parent']
            // добавляет данные — children не должны затереться.
            test('node can be both data and branch', function () {

                const roots = Builder.build(SCOPE, [
                    spec(['a', 'b', 'c'], { tag: 'c-data' }),
                    spec(['a', 'b'], { tag: 'b-data' }),
                    spec(['a'], { tag: 'a-data' }),
                ]);

                assert.strictEqual(roots.length, 1);

                const nodeA = roots.at(0);
                assert.ok(nodeA, 'nodeA must exist');
                assert.ok(Builder.Node.isBranch(nodeA), 'nodeA must be branch');
                assert.ok(Builder.Node.isData(nodeA), 'nodeA must have data');
                assert.strictEqual(nodeA.tag, 'a-data', 'nodeA must have tag "a-data"');
                nodePathCheck(nodeA, SCOPE, 'a');

                const nodeB = nodeA.children?.at(0);
                assert.ok(nodeB, 'nodeB must exist');
                assert.ok(Builder.Node.isBranch(nodeB), 'nodeB must be branch');
                assert.ok(Builder.Node.isData(nodeB), 'nodeB must have data');
                assert.strictEqual(nodeB.tag, 'b-data', 'nodeB must have tag "b-data"');
                nodePathCheck(nodeB, SCOPE, 'a', 'b');

                const nodeC = nodeB.children?.at(0);
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

                    const test = Builder.build(SCOPE, [items[i], items[j], items[k]]);

                    // Быстрая проверка
                    assert.strictEqual(test.length, 3);
                    assert.strictEqual((test[0] as any).tag, names[i], `[0] in permutation ${names[i]}, ${names[j]}, ${names[k]} must be ${names[i]}`);
                    assert.strictEqual((test[1] as any).tag, names[j], `[1] in permutation ${names[i]}, ${names[j]}, ${names[k]} must be ${names[j]}`);
                    assert.strictEqual((test[2] as any).tag, names[k], `[2] in permutation ${names[i]}, ${names[j]}, ${names[k]} must be ${names[k]}`);
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
                assert.strictEqual((expected[0] as any).tag, '1', 'a - tag must match');
                assert.strictEqual((expected[0] as any).children[0].tag, '2', 'b - tag must match');
                assert.strictEqual((expected[0] as any).children[0].children[0].tag, '3', 'c - tag must match');

                // все 5 перестановок
                for (const [i, j, k] of [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
                    const test = Builder.build(SCOPE, [items[i], items[j], items[k]]);
                    assert.deepStrictEqual(test, expected, `expected must match in permutation ${names[i]}, ${names[j]}, ${names[k]}`);
                }

            });


            suite('Edges', () => {

                // Тест на пустой ввод:
                // Что произойдет, если передать пустой массив specs ?.
                test('empty specs produce no root nodes', function () {
                    const roots = Builder.build(SCOPE, []);
                    assert.ok(Array.isArray(roots), 'must return an array');
                    assert.strictEqual(roots.length, 0);
                });


                // Семантика перезаписи: последний spec выигрывает. (тихо в prod-сборке).
                // Последний выигрывает (overwrite). Покрывает ветку warning-лога.
                test('duplicate path overwrites data', function () {

                    const roots = Builder.build(SCOPE, [
                        spec(['target'], { tag: 'original' }),
                        spec(['target'], { tag: 'replacement' }),
                    ]);

                    assert.strictEqual(roots.length, 1);

                    const node = roots.at(0);
                    assert.ok(node, 'must exist');
                    assert.ok(Builder.Node.isData(node), 'must remain DataNode');
                    assert.strictEqual(node.tag, 'replacement', 'later spec wins');
                });


                // Граничный случай: scopeId === segment на всех уровнях → дерево нормально строится, не схлопывается.
                test('scopeId identical to all segments does not collapse the tree', function () {
                    const V = 'same';
                    const roots = Builder.build(V, [
                        spec([V, V, V], { tag: 'leaf' }),
                        spec([V], { tag: 'root-data' }),
                    ]);

                    assert.strictEqual(roots.length, 1, 'single root branch');

                    const root = roots.at(0);
                    assert.ok(root, 'must exist');
                    assert.strictEqual(Builder.Node.decodeSegment(root), V);
                    nodePathCheck(root, V, V);
                    assert.ok(Builder.Node.isData(root), 'root must carry data');
                    assert.ok(Builder.Node.isBranch(root), 'root must be branch');
                    assert.strictEqual(root.tag, 'root-data');

                    assert.strictEqual(root.children?.length, 1);
                    const mid = root.children.at(0);
                    assert.ok(mid, 'must exist');
                    assert.strictEqual(Builder.Node.decodeSegment(mid), V);
                    nodePathCheck(mid, V, V, V);
                    assert.ok(!Builder.Node.isData(mid), 'intermediate must not have data');
                    assert.ok(Builder.Node.isBranch(mid), 'intermediate must be branch');

                    assert.strictEqual(mid.children.length, 1);
                    const leaf = mid.children.at(0);
                    assert.ok(leaf, 'must exist');
                    assert.strictEqual(Builder.Node.decodeSegment(leaf), V);
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
                        const roots = Builder.build(SCOPE, [items[i], items[j], items[k]]);

                        assert.ok(Array.isArray(roots), `${p}: must return an array`);
                        assert.strictEqual(roots.length, 2, `${p}: spec with empty segments must not produce a node`);

                        const first = roots.at(0);
                        assert.ok(first, `${p}: first must exist`);
                        nodePathCheck(first, SCOPE, 'X');
                        assert.ok(Builder.Node.isData(first), `${p}: first must be DataNode`);
                        assert.ok(!Builder.Node.isBranch(first), `${p}: first must not be branch`);
                        assert.strictEqual(first.tag, 'X', `${p}: first tag must match`);

                        const second = roots.at(1);
                        assert.ok(second, `${p}: second must exist`);
                        nodePathCheck(second, SCOPE, 'Z');
                        assert.ok(Builder.Node.isData(second), `${p}: second must be DataNode`);
                        assert.ok(!Builder.Node.isBranch(second), `${p}: second must not be branch`);
                        assert.strictEqual(second.tag, 'Z', `${p}: second tag must match`);
                    }
                });


                // Алгоритм защищен от пустого scopeId, но КОРРЕКТНО с ним работает
                test('parsePath correctly recovers empty scopeId', function () {

                    const segments = ['a', 'b', 'c'];
                    const emptyScopeId = '';

                    const roots = Builder.build(emptyScopeId, [
                        spec(segments, { tag: 'leaf' }),
                    ]);

                    assert.strictEqual(roots.length, 1, 'single root branch');

                    assert.doesNotThrow(() => {

                        const nodeA = roots.at(0);
                        assert.ok(nodeA, 'nodeA must exist');
                        assert.ok(Builder.Node.isBranch(nodeA), 'nodeA must be branch');
                        assert.ok(!Builder.Node.isData(nodeA), 'nodeA must not have data');
                        nodePathCheck(nodeA, emptyScopeId, ...segments.slice(0, 1));

                        const nodeB = nodeA.children.at(0);
                        assert.ok(nodeB, 'nodeB must exist');
                        assert.ok(Builder.Node.isBranch(nodeB), 'nodeB must be branch');
                        assert.ok(!Builder.Node.isData(nodeB), 'nodeB must not have data');
                        nodePathCheck(nodeB, emptyScopeId, ...segments.slice(0, 2));

                        const nodeC = nodeB.children.at(0);
                        assert.ok(nodeC, 'nodeC must exist');
                        assert.ok(!Builder.Node.isBranch(nodeC), 'nodeC must not be branch');
                        assert.ok(Builder.Node.isData(nodeC), 'nodeC must have data');
                        assert.strictEqual(nodeC.tag, 'leaf', 'nodeC must have tag "leaf"');
                        nodePathCheck(nodeC, emptyScopeId, ...segments.slice(0, 3));

                    },
                        '"" в scopeId НЕ ломает parsePath'
                    );

                });


                // Алгоритм защищен от сегментов, состоящих из пустых строк
                test('parsePath correctly recovers empty segments', function () {

                    const segments = ['a', '', 'c'];

                    const roots = Builder.build(SCOPE, [
                        spec(segments, { tag: 'leaf' }),
                    ]);

                    assert.strictEqual(roots.length, 1, 'single root branch');

                    const nodeA = roots.at(0);
                    assert.ok(nodeA, 'nodeA must exist');
                    assert.ok(Builder.Node.isBranch(nodeA), 'nodeA must be branch');
                    assert.ok(!Builder.Node.isData(nodeA), 'nodeA must not have data');
                    nodePathCheck(nodeA, SCOPE, ...segments.slice(0, 1));

                    const nodeB = nodeA.children.at(0);
                    assert.ok(nodeB, 'nodeB must exist');
                    assert.ok(Builder.Node.isBranch(nodeB), 'nodeB must be branch');
                    assert.ok(!Builder.Node.isData(nodeB), 'nodeB must not have data');
                    // на всякий случай, для понимания:
                    // `parsePath` — востанавливает, 
                    // `decodeSegment` — востанавливает, 
                    // но `_segment` не содержит
                    nodePathCheck(nodeB, SCOPE, ...segments.slice(0, 2));
                    assert.strictEqual(Builder.Node.decodeSegment(nodeB), '');
                    assert.notStrictEqual(nodeB._segment, '', '`_segment` does not have to be empty');

                    const nodeC = nodeB.children.at(0);
                    assert.ok(nodeC, 'nodeC must exist');
                    assert.ok(!Builder.Node.isBranch(nodeC), 'nodeC must not be branch');
                    assert.ok(Builder.Node.isData(nodeC), 'nodeC must have data');
                    assert.strictEqual(nodeC.tag, 'leaf', 'nodeC must have tag "leaf"');
                    nodePathCheck(nodeC, SCOPE, ...segments.slice(0, 3));

                });


                suite('parsePath - Known Issues', function () {

                    // Алгоритм в prod-сборке не защищен от SEPARATOR в scopeId, и НЕ корректно с ним работает
                    test('parsePath NOT correctly recovers scopeId with SEPARATOR (No treatment is required)', function () {

                        const segments = ['a', 'b', 'c'];
                        const evilScopeId = `ID${Builder.SEPARATOR}`;

                        const roots = Builder.build(evilScopeId, [
                            spec(segments, { tag: 'leaf' }),
                        ]);

                        assert.strictEqual(roots.length, 1, 'single root branch');

                        assert.throws(() => {

                            const nodeA = roots.at(0);
                            assert.ok(nodeA, 'nodeA must exist');
                            assert.ok(Builder.Node.isBranch(nodeA), 'nodeA must be branch');
                            assert.ok(!Builder.Node.isData(nodeA), 'nodeA must not have data');
                            nodePathCheck(nodeA, evilScopeId, ...segments.slice(0, 1));

                            const nodeB = nodeA.children.at(0);
                            assert.ok(nodeB, 'nodeB must exist');
                            assert.ok(Builder.Node.isBranch(nodeB), 'nodeB must be branch');
                            assert.ok(!Builder.Node.isData(nodeB), 'nodeB must not have data');
                            nodePathCheck(nodeB, evilScopeId, ...segments.slice(0, 2));

                            const nodeC = nodeB.children.at(0);
                            assert.ok(nodeC, 'nodeC must exist');
                            assert.ok(!Builder.Node.isBranch(nodeC), 'nodeC must not be branch');
                            assert.ok(Builder.Node.isData(nodeC), 'nodeC must have data');
                            assert.strictEqual(nodeC.tag, 'leaf', 'nodeC must have tag "leaf"');
                            nodePathCheck(nodeC, evilScopeId, ...segments.slice(0, 3));
                        },
                            {
                                // OK ­— SEPARATOR в scopeId ломает parsePath
                                code: 'ERR_ASSERTION', message: /scopeId must match/
                            }
                        );

                    });


                    // Алгоритм в prod-сборке не защищен от сегментов, содержащих SEPARATOR
                    test('parsePath NOT correctly recovers segments with SEPARATOR (No treatment is required)', function () {

                        const segments = ['a', `b${Builder.SEPARATOR}`, 'c'];

                        const roots = Builder.build(SCOPE, [
                            spec(segments, { tag: 'leaf' }),
                        ]);

                        assert.strictEqual(roots.length, 1, 'single root branch');

                        assert.throws(() => {

                            const nodeA = roots.at(0);
                            assert.ok(nodeA, 'nodeA must exist');
                            assert.ok(Builder.Node.isBranch(nodeA), 'nodeA must be branch');
                            assert.ok(!Builder.Node.isData(nodeA), 'nodeA must not have data');
                            nodePathCheck(nodeA, SCOPE, ...segments.slice(0, 1));

                            const nodeB = nodeA.children.at(0);
                            assert.ok(nodeB, 'nodeB must exist');
                            assert.ok(Builder.Node.isBranch(nodeB), 'nodeB must be branch');
                            assert.ok(!Builder.Node.isData(nodeB), 'nodeB must not have data');
                            nodePathCheck(nodeB, SCOPE, ...segments.slice(0, 2));

                            const nodeC = nodeB.children.at(0);
                            assert.ok(nodeC, 'nodeC must exist');
                            assert.ok(!Builder.Node.isBranch(nodeC), 'nodeC must not be branch');
                            assert.ok(Builder.Node.isData(nodeC), 'nodeC must have data');
                            assert.strictEqual(nodeC.tag, 'leaf', 'nodeC must have tag "leaf"');
                            nodePathCheck(nodeC, SCOPE, ...segments.slice(0, 3));
                        },
                            {
                                // OK ­— SEPARATOR в сегменте ломает parsePath
                                code: 'ERR_ASSERTION', message: /segments must match/
                            }
                        );

                    });

                });

            });

        });

    });

});