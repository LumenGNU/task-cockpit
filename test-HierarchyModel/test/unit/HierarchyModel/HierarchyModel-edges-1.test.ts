import * as assert from 'node:assert/strict';
import HierarchyModel from 'src/HierarchyModel/HierarchyModel';
import buildTree from '../buildTree';


suite('HierarchyModel', function () {

    suite('buildHierarchy', function () {

        suite('Граничные случаи', function () {

            suite('Коллизия типов: узел одновременно лист и ветка', function () {

                // Сначала добавляется лист, потом тот же узел получает детей — должен превратиться в ветку.
                // Сначала добавляется промежуточный узел без данных, потом ему добавляются данные — становится листом.
                // Порядок поступления таких спек не повлияет ни на структуру, ни на порядок узлов.
                // Проверяется, что при любом порядке построения дерево корректно отражает обе роли.

                suite('сначала лист, потом тот же узел — уже ветка', function () {

                    const specs = [
                        { segments: ['aaa', 'subRunnable'], data: {} },
                        // bbb создан как лист, потом в него пытаются добавить ребёнка
                        { segments: ['aaa', 'subRunnable', 'runnable'], data: {} },
                    ];


                    test('компрессия off', function () {

                        const hierarchy = HierarchyModel.buildHierarchy<{}>(
                            {
                                branchPrefix: 'pref',
                                branchKey: 'key',
                                specs
                            },
                            'off'
                        );

                        const lines = buildTree(hierarchy.children, '', true);

                        assert.deepEqual(lines, [
                            '─ aaa',
                            '  └─ ▶ subRunnable',
                            '     └─ ▶ runnable'
                        ], 'ascii дерево должно совпадать');
                    });

                    test('компрессия on', function () {

                        const hierarchy = HierarchyModel.buildHierarchy<{}>(
                            {
                                branchPrefix: 'pref',
                                branchKey: 'key',
                                specs
                            },
                            'on'
                        );

                        const lines = buildTree(hierarchy.children, '', true);

                        assert.deepEqual(lines, [
                            // в "on" лист должен остаться отдельным
                            // узлом — сжимать нечего
                            '─ aaa',
                            '  └─ ▶ subRunnable',
                            '     └─ ▶ runnable'
                        ], 'ascii дерево должно совпадать');
                    });

                    test('компрессия on-aggressive', function () {

                        const hierarchy = HierarchyModel.buildHierarchy<{}>(
                            {
                                branchPrefix: 'pref',
                                branchKey: 'key',
                                specs
                            },
                            'on-aggressive'
                        );

                        const lines = buildTree(hierarchy.children, '', true);

                        assert.deepEqual(lines, [
                            // Сжать сильнее невозможно:
                            // должно быть минимум два узла (по числу листов) со своими данными,
                            // слить их в один узел без потери этих данных невозможно.
                            '─ ▶ aaa › subRunnable',
                            '  └─ ▶ runnable'
                        ], 'ascii дерево должно совпадать');
                    });

                });

                suite('сначала ветка — потом должна стать ещё и листом', function () {

                    const specs = [
                        { segments: ['aaa', 'subRunnable', 'runnable'], data: {} },
                        // bbb уже существует как промежуточный узел без data, теперь надо добавить data
                        { segments: ['aaa', 'subRunnable'], data: {} },
                    ];

                    test('компрессия off', function () {

                        const hierarchy = HierarchyModel.buildHierarchy<{}>(
                            {
                                branchPrefix: 'pref',
                                branchKey: 'key',
                                specs
                            },
                            'off'
                        );

                        const lines = buildTree(hierarchy.children, '', true);

                        assert.deepEqual(lines, [
                            '─ aaa',
                            '  └─ ▶ subRunnable',
                            '     └─ ▶ runnable'
                        ], 'ascii дерево должно совпадать');
                    });

                    test('компрессия on', function () {

                        const hierarchy = HierarchyModel.buildHierarchy<{}>(
                            {
                                branchPrefix: 'pref',
                                branchKey: 'key',
                                specs
                            },
                            'on'
                        );

                        const lines = buildTree(hierarchy.children, '', true);

                        assert.deepEqual(lines, [
                            '─ aaa',
                            '  └─ ▶ subRunnable',
                            '     └─ ▶ runnable'
                        ], 'ascii дерево должно совпадать');
                    });

                    test('компрессия on-aggressive', function () {

                        const hierarchy = HierarchyModel.buildHierarchy<{}>(
                            {
                                branchPrefix: 'pref',
                                branchKey: 'key',
                                specs
                            },
                            'on-aggressive'
                        );

                        const lines = buildTree(hierarchy.children, '', true);

                        assert.deepEqual(lines, [
                            '─ ▶ aaa › subRunnable',
                            '  └─ ▶ runnable'
                        ], 'ascii дерево должно совпадать');
                    });
                });


            });


            suite('Единственная линейная цепочка без ветвлений', function () {

                // Сжимается по-разному в зависимости от режима:
                // off — каждый сегмент отдельный узел.
                // on — сжимаются только все промежуточные узлы.
                // on-aggressive —  сжимаются все узлы и лист —
                // вся цепочка становится одним комбинированным узлом.

                const specs = [
                    { segments: ['a', 'b', 'c', 'd', 'runnable'], data: {} }
                ];

                test('компрессия off', function () {

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'off'
                    );

                    const lines = buildTree(hierarchy.children, '', true);

                    assert.deepEqual(lines, [
                        // структура "as is"
                        '─ a',
                        '  └─ b',
                        '     └─ c',
                        '        └─ d',
                        '           └─ ▶ runnable'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on'
                    );

                    const lines = buildTree(hierarchy.children, '', true);

                    assert.deepEqual(lines, [
                        // все промежуточные узлы сжаты,
                        // лист - отдельный узел
                        '─ a › b › c › d',
                        '  └─ ▶ runnable'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on-aggressive'
                    );

                    const lines = buildTree(hierarchy.children, '', true);

                    assert.deepEqual(lines, [
                        // все промежуточные узлы и
                        // лист - сжаты
                        '─ ▶ a › b › c › d › runnable'
                    ], 'ascii дерево должно совпадать');
                });
            });


            suite('Несколько корневых элементов', function () {

                // Строятся независимые корневые поддеревья, порядок
                // сохраняется по порядку первого добавления.

                const specs = [
                    { segments: ['aaa', 'runnable1'], data: {} },
                    { segments: ['bbb', 'runnable2'], data: {} },
                    { segments: ['aaa', 'runnable3'], data: {} },  // aaa уже существует
                ];

                test('компрессия off', function () {

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'off'
                    );

                    const lines = buildTree(hierarchy.children, '', true);

                    assert.deepEqual(lines, [
                        '─ aaa',
                        '  ├─ ▶ runnable1',
                        '  └─ ▶ runnable3',
                        '─ bbb',
                        '  └─ ▶ runnable2'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on'
                    );

                    const lines = buildTree(hierarchy.children, '', true);

                    assert.deepEqual(lines, [
                        // сжимать нечего:
                        // aaa - несколько детей
                        // bbb - один ребенок, но он лист
                        '─ aaa',
                        '  ├─ ▶ runnable1',
                        '  └─ ▶ runnable3',
                        '─ bbb',
                        '  └─ ▶ runnable2'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on-aggressive'
                    );

                    const lines = buildTree(hierarchy.children, '', true);

                    assert.deepEqual(lines, [
                        // можно сжать только bbb+runnable2
                        '─ aaa',
                        '  ├─ ▶ runnable1',
                        '  └─ ▶ runnable3',
                        '─ ▶ bbb › runnable2'
                    ], 'ascii дерево должно совпадать');
                });

            });

            suite('Дети с перемежающимися типами (лист между ветками)', function () {

                // Порядок детей в выводе соответствует порядку спецификаций, ветки и листья корректно чередуются.

                const specs = [
                    { segments: ['root', 'branch1', 'runnable1'], data: {} },
                    { segments: ['root', 'direct-runnable'], data: {} },      // лист между двух веток
                    { segments: ['root', 'branch2', 'runnable2'], data: {} },
                ];

                test('компрессия off', function () {

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'off'
                    );

                    const lines = buildTree(hierarchy.children, '', true);

                    assert.deepEqual(lines, [
                        '─ root',
                        '  ├─ branch1',
                        '  │  └─ ▶ runnable1',
                        '  ├─ ▶ direct-runnable',
                        '  └─ branch2',
                        '     └─ ▶ runnable2'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on'
                    );

                    const lines = buildTree(hierarchy.children, '', true);

                    assert.deepEqual(lines, [
                        // "on" - сжимать нечего
                        '─ root',
                        '  ├─ branch1',
                        '  │  └─ ▶ runnable1',
                        '  ├─ ▶ direct-runnable',
                        '  └─ branch2',
                        '     └─ ▶ runnable2'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on-aggressive'
                    );

                    const lines = buildTree(hierarchy.children, '', true);

                    assert.deepEqual(lines, [
                        // одинокие листы сжаты
                        '─ root',
                        '  ├─ ▶ branch1 › runnable1',
                        '  ├─ ▶ direct-runnable',
                        '  └─ ▶ branch2 › runnable2'
                    ], 'ascii дерево должно совпадать');
                });

            });


            suite('Один элемент с одним сегментом', function () {

                const specs = [
                    { segments: ['lone'], data: {} }
                ];
                test('компрессия off', function () {

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'off'
                    );

                    const lines = buildTree(hierarchy.children, '', true);

                    assert.deepEqual(lines, [
                        '─ ▶ lone'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on'
                    );

                    const lines = buildTree(hierarchy.children, '', true);

                    assert.deepEqual(lines, [
                        '─ ▶ lone'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on-aggressive'
                    );

                    const lines = buildTree(hierarchy.children, '', true);

                    assert.deepEqual(lines, [
                        '─ ▶ lone'
                    ], 'ascii дерево должно совпадать');
                });

            });

        });
    });
});
