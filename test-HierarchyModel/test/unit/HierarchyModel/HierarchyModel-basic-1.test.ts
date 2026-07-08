import * as assert from 'node:assert/strict';
import HierarchyModel from 'src/HierarchyModel/HierarchyModel';
import buildAsciiTree from '../buildAsciiTree';



suite('HierarchyModel', function () {

    suite('buildHierarchy', function () {

        suite('Простая вложенность', function () {
            const specs = new Map([
                ['branch', [
                    { segments: ['a', 'b-runnable'], data: {} },
                    { segments: ['a', 'b-runnable', 'c-runnable'], data: {} }
                ]]
            ]);

            test('компрессия off', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specs,
                    'off'
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '─ [[branch]]',
                    '    └─ a',
                    '       └─ ▶ b-runnable',
                    '          └─ ▶ c-runnable'
                ], 'ascii дерево должно совпадать');
            });

            test('компрессия on', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specs,
                    'on'
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    // нечего сжимать:
                    // runnable-узел — всегда отдельный узел
                    '─ [[branch]]',
                    '    └─ a',
                    '       └─ ▶ b-runnable',
                    '          └─ ▶ c-runnable'
                ], 'ascii дерево должно совпадать');
            });

            test('компрессия on-aggressive', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specs,
                    'on-aggressive'
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    // Сжато максимально - до двух узлов.
                    // Почему именно так:
                    // Сжатие между b-runnable и c-runnable невозможно: они несут разные данные.
                    // Сжатие между a и c-runnable невозможно: они не смежные, между ними b-runnable.

                    '─ [[branch]]',
                    '    └─ ▶ a › b-runnable',
                    '       └─ ▶ c-runnable'
                ], 'ascii дерево должно совпадать');
            });
        });


        suite('Простая вложенность, несколько корней', function () {

            const specs = new Map([
                ['branch', [
                    { segments: ['runnable1'], data: {} },
                    { segments: ['group1', 'runnable2'], data: {} },
                    { segments: ['group2', 'runnable3'], data: {} },
                    { segments: ['group2', 'runnable4'], data: {} }
                ]]
            ]);

            test('компрессия off', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specs,
                    'off'
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '─ [[branch]]',
                    '    ├─ ▶ runnable1',
                    '    ├─ group1',
                    '    │  └─ ▶ runnable2',
                    '    └─ group2',
                    '       ├─ ▶ runnable3',
                    '       └─ ▶ runnable4'
                ], 'ascii дерево должно совпадать');
            });

            test('компрессия on', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specs,
                    'on'
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    // как и при 'off', нечего сжимать:
                    // group1 имеет одного ребенка, но он лист -
                    // и при 'on' должен остаться отдельным узлом
                    '─ [[branch]]',
                    '    ├─ ▶ runnable1',
                    '    ├─ group1',
                    '    │  └─ ▶ runnable2',
                    '    └─ group2',
                    '       ├─ ▶ runnable3',
                    '       └─ ▶ runnable4'
                ], 'ascii дерево должно совпадать');
            });

            test('компрессия on-aggressive', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specs,
                    'on-aggressive'
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    // group1 имеет одного ребенка (лист) -
                    // сжато в один узел
                    '─ [[branch]]',
                    '    ├─ ▶ runnable1',
                    '    ├─ ▶ group1 › runnable2',
                    '    └─ group2',
                    '       ├─ ▶ runnable3',
                    '       └─ ▶ runnable4'
                ], 'ascii дерево должно совпадать');
            });
        });

        suite('Простая вложенность, несколько корней. Разный порядок', function () {

            // структура дерева не зависит от порядка поступления спек.
            // Порядок элементов в структуре — зависит.

            suite('Лист добавлен до поддерева-соседа', function () {

                const specs = new Map([
                    ['branch', [
                        { segments: ['aaa', 'bbb', 'ccc', 'ccc-runnable'], data: {} },
                        { segments: ['aaa', 'bbb', 'ccc', 'ddd', 'ddd-runnable'], data: {} },
                    ]]
                ]);

                test('компрессия off', function () {
                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'off'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '─ [[branch]]',
                        '    └─ aaa',
                        '       └─ bbb',
                        '          └─ ccc',
                        '             ├─ ▶ ccc-runnable',
                        '             └─ ddd',
                        '                └─ ▶ ddd-runnable'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {
                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // Однодетные промежуточные узлы сжаты.
                        // Листы — отдельные узлы.
                        // Порядок aa→bbb→ccc→ddd сохраняется.
                        '─ [[branch]]',
                        '    └─ aaa › bbb › ccc',
                        '       ├─ ▶ ccc-runnable',
                        '       └─ ddd',
                        '          └─ ▶ ddd-runnable'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {
                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on-aggressive'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // Однодетные промежуточные узлы сжаты.
                        // Лист ddd-runnable сжат — он единственный ребенок.
                        // Порядок aaa→bbb→ccc→ddd сохраняется.
                        '─ [[branch]]',
                        '    └─ aaa › bbb › ccc',
                        '       ├─ ▶ ccc-runnable',
                        '       └─ ▶ ddd › ddd-runnable'
                    ], 'ascii дерево должно совпадать');
                });

            });

            suite('Поддерево-сосед добавлено до листа', function () {

                const specs = new Map([
                    ['branch', [
                        { segments: ['aaa', 'bbb', 'ccc', 'ddd', 'ddd-runnable'], data: {} },
                        { segments: ['aaa', 'bbb', 'ccc', 'ccc-runnable'], data: {} },
                    ]]
                ]);

                test('компрессия off', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'off'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // Порядок aaa→bbb→ccc→ddd,
                        // но ccc-лист вставлен после появления ddd-группы.
                        '─ [[branch]]',
                        '    └─ aaa',
                        '       └─ bbb',
                        '          └─ ccc',
                        '             ├─ ddd',
                        '             │  └─ ▶ ddd-runnable',
                        '             └─ ▶ ccc-runnable'
                    ], 'ascii дерево должно совпадать');

                });

                test('компрессия on', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // Однодетные промежуточные узлы сжаты.
                        // Листы — отдельные узлы.
                        // Порядок aa→bbb→ccc→ddd,
                        // но ccc-лист вставлен после появления
                        // ddd-группы.
                        '─ [[branch]]',
                        '    └─ aaa › bbb › ccc',
                        '       ├─ ddd',
                        '       │  └─ ▶ ddd-runnable',
                        '       └─ ▶ ccc-runnable'
                    ], 'ascii дерево должно совпадать');

                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on-aggressive'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // Однодетные промежуточные узлы сжаты.
                        // Лист ddd-runnable сжат — он единственный ребенок.
                        // Порядок aaa→bbb→ccc→ddd,
                        // но ccc-лист вставлен после появления
                        // ddd-группы.
                        '─ [[branch]]',
                        '    └─ aaa › bbb › ccc',
                        '       ├─ ▶ ddd › ddd-runnable',
                        '       └─ ▶ ccc-runnable'
                    ], 'ascii дерево должно совпадать');

                });
            });
        });
    });
});
