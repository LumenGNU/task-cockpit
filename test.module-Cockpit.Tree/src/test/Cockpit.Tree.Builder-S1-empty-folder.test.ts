import * as assert from 'assert/strict';
import Builder from '../Cockpit/Tree/Builder';


type D = { tag: string; };
type DN = Builder.DataNode<D, string>;


const SCOPE = 'S';


function spec(segments: ReadonlyArray<string>, data: D): Builder.SpecType<D> {
    return { segments, data };
}


/** Построить nodePath вручную: np('S', 'a', 'b') → 'S\0a\0b'. */
function np(...parts: string[]): string {
    return parts.join('\0');
}


// Precondition assertions — перед каждой мутацией/проверкой

suite('@module Cockpit/Tree/Builder', function () {


    setup(function () {

    });

    teardown(function () {

    });

    suite('build', () => {


        // структура дерева
        // ядро модуля
        suite('tree structure', () => {


            // Один сегмент — минимальный случай.
            // Один spec ['only'] → один корневой DataNode с данными и правильным nodePath.
            test('single segment produces one root DataNode', function () {
                const roots = Builder.build(SCOPE, [spec(['only'], { tag: 'x' })]);
                assert.strictEqual(roots.length, 1);

                const node = roots[0];
                assert.strictEqual(node.segment, 'only');
                assert.strictEqual(node.nodePath, np(SCOPE, 'only'));
                assert.ok(Builder.Node.isData(node), 'root must be DataNode');
                assert.strictEqual(node.tag, 'x');
                assert.ok(!Builder.Node.isBranch(node), 'pure leaf must not be branch');
            });


            // Цепочка сегментов — spec ['grandparent', 'parent', 'leaf'] → вложенная цепочка
            // из трёх узлов. Только лист содержит данные. Промежуточные — чистые branch'и.
            test('chained segments produce nested nodes with data on leaf', function () {
                const roots = Builder.build(SCOPE, [
                    spec(['grandparent', 'parent', 'leaf'], { tag: 'deep' }),
                ]);
                assert.strictEqual(roots.length, 1);

                const gp = roots[0];
                assert.ok(!Builder.Node.isData(gp), 'intermediate must not have data');
                assert.strictEqual(gp.segment, 'grandparent');
                assert.strictEqual(gp.children.length, 1);

                const parent = gp.children[0];
                assert.ok(!Builder.Node.isData(parent), 'intermediate must not have data');
                assert.strictEqual(parent.segment, 'parent');
                assert.strictEqual(parent.children.length, 1);

                const leaf = parent.children[0];
                assert.ok(Builder.Node.isData(leaf), 'leaf must have data');
                assert.strictEqual(leaf.segment, 'leaf');
                assert.strictEqual(leaf.tag, 'deep');
                assert.ok(!Builder.Node.isBranch(leaf), 'pure leaf must not be branch');
            });


            // Общий префикс — два spec'а ['trunk', 'left'] и ['trunk', 'right'] → один
            // промежуточный trunk с двумя детьми. Проверяет переиспользование узлов.
            test('shared prefix reuses intermediate node', function () {
                const roots = Builder.build(SCOPE, [
                    spec(['trunk', 'left'], { tag: 'L' }),
                    spec(['trunk', 'right'], { tag: 'R' }),
                ]);
                assert.strictEqual(roots.length, 1, 'shared trunk = one root');

                const trunk = roots[0];
                assert.ok(!Builder.Node.isData(trunk), 'trunk is pure intermediate');
                assert.strictEqual(trunk.children.length, 2);
                assert.strictEqual(trunk.children[0].segment, 'left');
                assert.strictEqual(trunk.children[1].segment, 'right');

                assert.ok(Builder.Node.isData(trunk.children[0]), 'left must be DataNode');
                assert.ok(Builder.Node.isData(trunk.children[1]), 'right must be DataNode');
                assert.strictEqual(trunk.children[0].tag, 'L');
                assert.strictEqual(trunk.children[1].tag, 'R');
            });


            // Узел — одновременно данные и ветка.
            // ['parent', 'child'] создаёт parent как промежуточный, затем ['parent']
            // добавляет данные через Object.assign — children не должны затереться.
            test('node can be both data and branch', function () {
                const roots = Builder.build(SCOPE, [
                    spec(['parent', 'child'], { tag: 'child-data' }),
                    spec(['parent'], { tag: 'parent-data' }),
                ]);
                assert.strictEqual(roots.length, 1);

                const parent = roots[0];
                assert.ok(Builder.Node.isData(parent), 'parent must have data');
                assert.ok(Builder.Node.isBranch(parent), 'parent must still be branch');
                assert.strictEqual(parent.tag, 'parent-data');

                assert.ok(parent.children, 'must have children');
                assert.strictEqual(parent.children.length, 1);
                assert.strictEqual(parent.children[0].segment, 'child');
            });


            // Порядок спецификаций не влияет на структуру:
            // [['parent', 'child', 'grandchild'], ['parent', 'child']]
            // и наоборот — дают структурно идентичные деревья.
            test('spec order does not affect tree structure', function () {

                const deep = spec(['a', 'b', 'c'], { tag: '1' });
                const shallow = spec(['a', 'b'], { tag: '2' });

                const treeA = Builder.build(SCOPE, [deep, shallow]);
                const treeB = Builder.build(SCOPE, [shallow, deep]);

                assert.strictEqual(treeA.length, 1);
                assert.strictEqual(treeB.length, 1);
                assert.strictEqual(treeA[0].segment, treeB[0].segment);

                assert.ok(!Builder.Node.isData(treeA[0]));
                assert.ok(!Builder.Node.isData(treeB[0]));
                assert.strictEqual(treeA[0].children.length, treeB[0].children.length);
                assert.strictEqual(treeA[0].children[0].segment, treeB[0].children[0].segment);

                assert.ok(Builder.Node.isData(treeA[0].children[0]));
                assert.ok(Builder.Node.isData(treeB[0].children[0]));

                assert.ok(Builder.Node.isBranch(treeA[0].children[0]), 'b must be branch in treeA');
                assert.ok(Builder.Node.isBranch(treeB[0].children[0]), 'b must be branch in treeB');
                assert.strictEqual(treeA[0].children[0].children?.length, 1, 'c must exist in treeA');
                assert.strictEqual(treeB[0].children[0].children?.length, 1, 'c must exist in treeB');
                assert.strictEqual(treeA[0].children[0].children[0].segment, 'c');
                assert.strictEqual(treeB[0].children[0].children[0].segment, 'c');
            });


            // Позиция ветки определяется первым вхождением.
            // ['early'] идёт первой → в children корня сначала early, потом late.
            test('branch position follows first occurrence', function () {
                const x = spec(['x', 'nested'], { tag: '1' });
                const y = spec(['y'], { tag: '2' });

                // x первый → x первый в результате
                const forward = Builder.build(SCOPE, [x, y]);
                assert.strictEqual(forward[0].segment, 'x');
                assert.strictEqual(forward[1].segment, 'y');

                // y первый → y первый в результате
                const reversed = Builder.build(SCOPE, [y, x]);
                assert.strictEqual(reversed[0].segment, 'y');
                assert.strictEqual(reversed[1].segment, 'x');
            });


            // Несколько корневых узлов — порядок совпадает с порядком specs.
            test('multiple root nodes preserve spec order', function () {

                const specs = [
                    spec(['first'], { tag: '1' }),
                    spec(['second'], { tag: '2' }),
                    spec(['third'], { tag: '3' }),
                ];

                const roots = Builder.build(SCOPE, specs);

                assert.strictEqual(roots.length, 3);
                assert.strictEqual(roots[0].segment, 'first');
                assert.strictEqual(roots[1].segment, 'second');
                assert.strictEqual(roots[2].segment, 'third');

                const roots2 = Builder.build(SCOPE, [...specs].reverse());

                assert.strictEqual(roots2.length, 3);
                assert.strictEqual(roots2[0].segment, 'third');
                assert.strictEqual(roots2[1].segment, 'second');
                assert.strictEqual(roots2[2].segment, 'first');
            });


            // Дублирующиеся пути — два spec'а с segments: ['target'], разные данные.
            // Последний выигрывает (overwrite). Покрывает ветку warning-лога.
            test('duplicate path overwrites data', function () {
                const roots = Builder.build(SCOPE, [
                    spec(['target'], { tag: 'original' }),
                    spec(['target'], { tag: 'replacement' }),
                ]);
                assert.strictEqual(roots.length, 1);

                const node = roots[0];
                assert.ok(Builder.Node.isData(node), 'must remain DataNode');
                assert.strictEqual(node.tag, 'replacement', 'later spec wins');
            });

        });


        suite('nodePath', () => {


            // spec ['parent', 'child'] с scope "S":
            // промежуточный → "S\0parent", лист → "S\0parent\0child".
            test('nodePath uses NUL separator', function () {
                const roots = Builder.build(SCOPE, [
                    spec(['parent', 'child'], { tag: 'x' }),
                ]);

                const parent = roots[0];
                assert.strictEqual(parent.nodePath, np(SCOPE, 'parent'));

                assert.ok(!Builder.Node.isData(parent));
                assert.strictEqual(parent.children[0].nodePath, np(SCOPE, 'parent', 'child'));
            });


            // Разные scope → разные nodePath для одинаковых segments.
            test('different scopes produce different nodePaths', function () {
                const treeA = Builder.build('scope-A', [spec(['node'], { tag: 'a' })]);
                const treeB = Builder.build('scope-B', [spec(['node'], { tag: 'b' })]);

                assert.strictEqual(treeA[0].nodePath, np('scope-A', 'node'));
                assert.strictEqual(treeB[0].nodePath, np('scope-B', 'node'));
                assert.notStrictEqual(treeA[0].nodePath, treeB[0].nodePath);
            });

        });

    });


    suite('Node.isBranch', () => {


        // Чистый лист — ключ children отсутствует (??= не сработал).
        test('false for pure leaf', function () {
            const roots = Builder.build(SCOPE, [spec(['leaf'], { tag: 'x' })]);
            assert.ok(!Builder.Node.isBranch(roots[0]));
        });


        // Промежуточный узел — spec ['parent', 'child'] → isBranch(parent) === true.
        test('true for intermediate node', function () {
            const roots = Builder.build(SCOPE, [spec(['parent', 'child'], { tag: 'x' })]);
            assert.ok(Builder.Node.isBranch(roots[0]));
        });


        // DataNode с детьми — ['parent'] + ['parent', 'child'] →
        // узел parent — и data, и branch одновременно.
        test('true for data node with children', function () {
            const roots = Builder.build(SCOPE, [
                spec(['parent', 'child'], { tag: 'child' }),
                spec(['parent'], { tag: 'parent' }),
            ]);
            assert.ok(Builder.Node.isBranch(roots[0]));
            assert.ok(Builder.Node.isData(roots[0]));
        });

    });


    suite('Node.isData', () => {


        // Промежуточный узел — spec ['parent', 'child'] → isData(parent) === false.
        test('false for intermediate node', function () {
            const roots = Builder.build(SCOPE, [spec(['parent', 'child'], { tag: 'x' })]);
            assert.ok(!Builder.Node.isData(roots[0]));
        });


        // Лист с данными — isData === true, данные доступны на узле.
        test('true for leaf with data', function () {
            const roots = Builder.build(SCOPE, [spec(['parent', 'leaf'], { tag: 'found' })]);

            assert.ok(!Builder.Node.isData(roots[0]));
            const leaf = roots[0].children[0];
            assert.ok(Builder.Node.isData(leaf), 'leaf must have data');
            assert.strictEqual(leaf.tag, 'found');
        });


        // DataNode с детьми — isData === true даже при наличии children.
        test('true for data node with children', function () {
            const roots = Builder.build(SCOPE, [
                spec(['parent'], { tag: 'has-data' }),
                spec(['parent', 'child'], { tag: 'child' }),
            ]);
            assert.ok(Builder.Node.isData(roots[0]));
            assert.ok(Builder.Node.isBranch(roots[0]));
        });

    });


    suite('parsePath', () => {


        // Стандартный путь — "S\0parent\0child" → ["S", "parent", "child"].
        test('splits multi-segment nodePath', function () {
            const roots = Builder.build(SCOPE, [spec(['parent', 'child'], { tag: 'x' })]);

            assert.ok(!Builder.Node.isData(roots[0]));
            const child = roots[0].children[0];
            assert.deepStrictEqual(Builder.parsePath(child), [SCOPE, 'parent', 'child']);
        });


        // Минимальный валидный случай — "S\0leaf" → ["S", "leaf"].
        test('splits single-segment nodePath', function () {
            const roots = Builder.build(SCOPE, [spec(['leaf'], { tag: 'x' })]);
            assert.deepStrictEqual(Builder.parsePath(roots[0]), [SCOPE, 'leaf']);
        });

    });


    suite('data properties', () => {


        // Произвольные поля данных доступны на DataNode как собственные свойства.
        test('data fields accessible on DataNode', function () {
            const roots = Builder.build(SCOPE, [
                { segments: ['leaf'], data: { label: 'hello', priority: 1 } },
            ]);
            assert.ok(Builder.Node.isData(roots[0]));
            assert.strictEqual(roots[0].label, 'hello');
            assert.strictEqual(roots[0].priority, 1);
        });


        // Runtime не защищает от коллизии ключей data с 'segment'|'nodePath'|'children'.
        // Типизация отсекает это на уровне компиляции.
        // Тест документирует: если защиту обойти — Object.assign затрёт служебные поля.
        test('runtime is not protected from data key collisions (types enforce this)', function () {

            const roots = Builder.build(SCOPE, [
                {
                    segments: ['target'], data: {
                        tag: 'ok',
                        // @ts-expect-error
                        segment: 'evil',
                        // @ts-expect-error
                        children: 'evil',
                        // @ts-expect-error
                        nodePath: 'evil',
                    }
                },
            ]);

            const node = roots[0];
            assert.strictEqual(node.segment, 'evil', 'Object.assign overwrites structural fields');
            assert.strictEqual(node.children, 'evil', 'Object.assign overwrites structural fields');
            assert.strictEqual(node.nodePath, 'evil', 'Object.assign overwrites structural fields');
        });

    });

});