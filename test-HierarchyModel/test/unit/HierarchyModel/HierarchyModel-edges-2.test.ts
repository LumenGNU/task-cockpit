import * as assert from 'node:assert/strict';
import HierarchyModel from 'src/HierarchyModel/HierarchyModel';
import buildTree from '../buildTree';


suite('HierarchyModel', function () {

    suite('buildHierarchy', function () {

        suite('Граничные случаи', function () {

            suite('Ветвление сразу после точки компрессии (чистый промежуточный узел)', function () {

                // Проверяется, что алгоритм не сжимает промежуточный узел, если у него появляется
                // второй ребёнок уже после того, как он был кандидатом на сжатие.
                // То есть сжатие применяется только тогда, когда окончательно известно,
                // что узел имеет ровно одного потомка.

                const specs = [
                    // a → b → c — одна цепочка, b был бы частью цепочки в a › b › c.
                    { segments: ['a', 'b', 'c', 'runnable1'], data: {} },
                    // Но теперь у b два ребёнка (c и d), значит b — конец цепочки сжатий.
                    { segments: ['a', 'b', 'd', 'runnable2'], data: {} },
                    // Если алгоритм решает про компрессию b до того, как все его
                    // дети известны — получим неверное дерево.
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

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        '─ a',
                        '  └─ b',
                        '     ├─ c',
                        '     │  └─ ▶ runnable1',
                        '     └─ d',
                        '        └─ ▶ runnable2'
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

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        '─ a › b',
                        '  ├─ c',
                        '  │  └─ ▶ runnable1',
                        '  └─ d',
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

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        // on-aggressive — c → runnable1 и d → runnable2 — каждый с одним
                        // ребёнком — должны схлопнуться в ▶ c › runnable1 и ▶ d › runnable2.
                        '─ a › b',
                        '  ├─ ▶ c › runnable1',
                        '  └─ ▶ d › runnable2'
                    ], 'ascii дерево должно совпадать');
                });

            });

            suite('Ветвление сразу после точки компрессии (промежуточный узел с данными)', function () {

                const specs = [
                    { segments: ['a', 'x'], data: {} },
                    { segments: ['a', 'x', 'y'], data: {} },
                    // После первых двух specs узел x имеет данные и ровно одного ребёнка (лист),
                    // он может быть объединён с родителем a в 'a › x'.
                    { segments: ['a', 'x', 'z'], data: {} }
                    // Третья spec добавляет в x второго ребёнка, что делает сжатие после x некорректным,
                    // значит x — конец цепочки сжатий.
                    // Реализация должна уметь «разжимать» такой узел или откладывать решение.
                ];

                test('компрессия off', function () {
                    // ничего особенного не происходит

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'off'
                    );

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        '─ a',
                        '  └─ ▶ x',
                        '     ├─ ▶ y',
                        '     └─ ▶ z'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {
                    // промежуточный 'a' сливается

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on'
                    );

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        // нечего сжимать:
                        // в "on" лист не может стать частью сжатия
                        '─ a',
                        '  └─ ▶ x',
                        '     ├─ ▶ y',
                        '     └─ ▶ z'
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

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        // максимальное сжатие: три узла
                        '─ ▶ a › x',
                        '  ├─ ▶ y',
                        '  └─ ▶ z',
                    ], 'ascii дерево должно совпадать');
                });
            });

            suite('Чередование данных в цепочке', function () {
                // Если в цепочке A → B → C → D данные есть у B и у D,
                // компрессия узлов должна остановиться на B, чтобы не потерять её данные

                const specs = [
                    { segments: ['A', 'B'], data: {} },
                    { segments: ['A', 'B', 'C', 'D'], data: {} },
                ];

                test('компрессия off', function () {
                    // ничего особенного не происходит

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'off'
                    );

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        '─ A',
                        '  └─ ▶ B',
                        '     └─ C',
                        '        └─ ▶ D'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {
                    //

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on'
                    );

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        // сжимать нечего, лист - всегда отдельный узел,
                        // не участвующий в сжатии
                        '─ A',
                        '  └─ ▶ B',
                        '     └─ C',
                        '        └─ ▶ D'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {
                    //

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on-aggressive'
                    );

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        // A+B слиты (у A нет данных), C+D слиты (у C нет данных),
                        // но два получившихся узла не слиты друг с другом, т.к. каждый несет свои данные.
                        '─ ▶ A › B',
                        '  └─ ▶ C › D'
                    ], 'ascii дерево должно совпадать');
                });

            });

            suite('Чередование данных в цепочке, плюс промежуточный уровень', function () {

                const specs = [
                    { segments: ['A', 'B'], data: {} },
                    { segments: ['A', 'B', 'C', 'D', 'E'], data: {} },
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

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        // ничего особенного не происходит
                        '─ A',
                        '  └─ ▶ B',
                        '     └─ C',
                        '        └─ D',
                        '           └─ ▶ E'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {
                    //

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on'
                    );

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        // только "не значащий" промежуток C→D сжат
                        '─ A',
                        '  └─ ▶ B',
                        '     └─ C › D',
                        '        └─ ▶ E'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {
                    //

                    const hierarchy = HierarchyModel.buildHierarchy<{}>(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'on-aggressive'
                    );

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        // все сжато до двух узлов
                        '─ ▶ A › B',
                        '  └─ ▶ C › D › E'
                    ], 'ascii дерево должно совпадать');
                });

            });

            suite('Сегмент, содержащий пустую строку', function () {
                // ничего особенного не происходит

                const specs = [
                    { segments: ['a', '', 'b'], data: {} }
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

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        '─ a',
                        '  └─ ',
                        '     └─ ▶ b'
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

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        '─ a › ',
                        '  └─ ▶ b'
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

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        '─ ▶ a ›  › b'
                    ], 'ascii дерево должно совпадать');
                });
            });

        });
    });
});
