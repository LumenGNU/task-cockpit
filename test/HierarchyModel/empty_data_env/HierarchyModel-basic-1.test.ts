import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import HierarchyModel from '../../../src/HierarchyModel/HierarchyModel';
import type { Fixture } from '../extension';


suite('HierarchyModel', function () {

    let buildAsciiTree: Fixture['buildAsciiTree'];

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);

        const fixture: Fixture = await ext.activate();

        assert.ok(fixture);

        buildAsciiTree = fixture.buildAsciiTree;
    });

    suite('buildHierarchy', function () {

        suite('Простая вложенность', function () {

            const specsDict: HierarchyModel.SpecsDict<string, {}> = {
                branchKey: 'branch',
                specs: [
                    { segments: ['a', 'b-runnable'], data: {} },
                    { segments: ['a', 'b-runnable', 'c-runnable'], data: {} }
                ]
            };

            test('компрессия off', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specsDict,
                    HierarchyModel.PathCompression.OFF
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '└─ a',
                    '   └─ ▶ b-runnable',
                    '      └─ ▶ c-runnable'
                ], 'ascii дерево должно совпадать');
            });

            test('компрессия on', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specsDict,
                    HierarchyModel.PathCompression.ON
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    // нечего сжимать:
                    // runnable-узел — всегда отдельный узел
                    '└─ a',
                    '   └─ ▶ b-runnable',
                    '      └─ ▶ c-runnable'
                ], 'ascii дерево должно совпадать');
            });

            test('компрессия on-aggressive', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specsDict,
                    HierarchyModel.PathCompression.ON_AGGRESSIVE
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    // Сжато максимально - до двух узлов.
                    // Почему именно так:
                    // Сжатие между b-runnable и c-runnable невозможно: они несут разные данные.
                    // Сжатие между a и c-runnable невозможно: они не смежные, между ними b-runnable.
                    '└─ ▶ a › b-runnable',
                    '   └─ ▶ c-runnable'
                ], 'ascii дерево должно совпадать');
            });
        });


        suite('Простая вложенность, несколько корней', function () {

            const specsDict = {
                branchKey: 'branch',
                specs: [
                    { segments: ['runnable1'], data: {} },
                    { segments: ['group1', 'runnable2'], data: {} },
                    { segments: ['group2', 'runnable3'], data: {} },
                    { segments: ['group2', 'runnable4'], data: {} }
                ]
            };

            test('компрессия off', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specsDict,
                    HierarchyModel.PathCompression.OFF
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '├─ ▶ runnable1',
                    '├─ group1',
                    '│  └─ ▶ runnable2',
                    '└─ group2',
                    '   ├─ ▶ runnable3',
                    '   └─ ▶ runnable4'
                ], 'ascii дерево должно совпадать');
            });

            test('компрессия on', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specsDict,
                    HierarchyModel.PathCompression.ON
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    // как и при HierarchyModel.PathCompression.OFF, нечего сжимать:
                    // group1 имеет одного ребенка, но он лист -
                    // и при HierarchyModel.PathCompression.ON должен остаться отдельным узлом
                    '├─ ▶ runnable1',
                    '├─ group1',
                    '│  └─ ▶ runnable2',
                    '└─ group2',
                    '   ├─ ▶ runnable3',
                    '   └─ ▶ runnable4'
                ], 'ascii дерево должно совпадать');
            });

            test('компрессия on-aggressive', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specsDict,
                    HierarchyModel.PathCompression.ON_AGGRESSIVE
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    // group1 имеет одного ребенка (лист) -
                    // сжато в один узел
                    '├─ ▶ runnable1',
                    '├─ ▶ group1 › runnable2',
                    '└─ group2',
                    '   ├─ ▶ runnable3',
                    '   └─ ▶ runnable4'
                ], 'ascii дерево должно совпадать');
            });
        });

        suite('Простая вложенность, несколько корней. Разный порядок', function () {

            // структура дерева не зависит от порядка поступления спек.
            // Порядок элементов в структуре — зависит.

            suite('Лист добавлен до поддерева-соседа', function () {

                const specsDict = {
                    branchKey: 'branch',
                    specs: [
                        { segments: ['aaa', 'bbb', 'ccc', 'ccc-runnable'], data: {} },
                        { segments: ['aaa', 'bbb', 'ccc', 'ddd', 'ddd-runnable'], data: {} },
                    ]
                };

                test('компрессия off', function () {
                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        HierarchyModel.PathCompression.OFF
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '└─ aaa',
                        '   └─ bbb',
                        '      └─ ccc',
                        '         ├─ ▶ ccc-runnable',
                        '         └─ ddd',
                        '            └─ ▶ ddd-runnable'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {
                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        HierarchyModel.PathCompression.ON
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // Однодетные промежуточные узлы сжаты.
                        // Листы — отдельные узлы.
                        // Порядок aa→bbb→ccc→ddd сохраняется.
                        '└─ aaa › bbb › ccc',
                        '   ├─ ▶ ccc-runnable',
                        '   └─ ddd',
                        '      └─ ▶ ddd-runnable'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {
                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        HierarchyModel.PathCompression.ON_AGGRESSIVE
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // Однодетные промежуточные узлы сжаты.
                        // Лист ddd-runnable сжат — он единственный ребенок.
                        // Порядок aaa→bbb→ccc→ddd сохраняется.
                        '└─ aaa › bbb › ccc',
                        '   ├─ ▶ ccc-runnable',
                        '   └─ ▶ ddd › ddd-runnable'
                    ], 'ascii дерево должно совпадать');
                });

            });

            suite('Поддерево-сосед добавлено до листа', function () {

                const specsDict = {
                    branchKey: 'branch',
                    specs: [
                        { segments: ['aaa', 'bbb', 'ccc', 'ddd', 'ddd-runnable'], data: {} },
                        { segments: ['aaa', 'bbb', 'ccc', 'ccc-runnable'], data: {} },
                    ]
                };

                test('компрессия off', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        HierarchyModel.PathCompression.OFF
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // Порядок aaa→bbb→ccc→ddd,
                        // но ccc-лист вставлен после появления ddd-группы.
                        '└─ aaa',
                        '   └─ bbb',
                        '      └─ ccc',
                        '         ├─ ddd',
                        '         │  └─ ▶ ddd-runnable',
                        '         └─ ▶ ccc-runnable'
                    ], 'ascii дерево должно совпадать');

                });

                test('компрессия on', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        HierarchyModel.PathCompression.ON
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // Однодетные промежуточные узлы сжаты.
                        // Листы — отдельные узлы.
                        // Порядок aa→bbb→ccc→ddd,
                        // но ccc-лист вставлен после появления
                        // ddd-группы.
                        '└─ aaa › bbb › ccc',
                        '   ├─ ddd',
                        '   │  └─ ▶ ddd-runnable',
                        '   └─ ▶ ccc-runnable'
                    ], 'ascii дерево должно совпадать');

                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        HierarchyModel.PathCompression.ON_AGGRESSIVE
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // Однодетные промежуточные узлы сжаты.
                        // Лист ddd-runnable сжат — он единственный ребенок.
                        // Порядок aaa→bbb→ccc→ddd,
                        // но ccc-лист вставлен после появления
                        // ddd-группы.
                        '└─ aaa › bbb › ccc',
                        '   ├─ ▶ ddd › ddd-runnable',
                        '   └─ ▶ ccc-runnable'
                    ], 'ascii дерево должно совпадать');

                });
            });
        });
    });
});
