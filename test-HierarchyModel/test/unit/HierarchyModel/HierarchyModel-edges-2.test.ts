import * as assert from 'node:assert/strict';
import HierarchyModel from 'src/HierarchyModel/HierarchyModel';
import buildAsciiTree from '../buildAsciiTree';


suite('HierarchyModel', function () {

    suite('buildHierarchy', function () {

        suite('Граничные случаи', function () {

            suite('Ветвление сразу после точки компрессии (чистый промежуточный узел)', function () {

                // Проверяется, что алгоритм не сжимает промежуточный узел, если у него появляется
                // второй ребёнок уже после того, как он был кандидатом на сжатие.
                // То есть сжатие применяется только тогда, когда окончательно известно,
                // что узел имеет ровно одного потомка.

                const specs = new Map([
                    ['branch', [
                        // a → b → c — одна цепочка, b был бы частью цепочки в a › b › c.
                        { segments: ['a', 'b', 'c', 'runnable1'], data: {} },
                        // Но теперь у b два ребёнка (c и d), значит b — конец цепочки сжатий.
                        { segments: ['a', 'b', 'd', 'runnable2'], data: {} },
                        // Если алгоритм решает про компрессию b до того, как все его
                        // дети известны — получим неверное дерево.
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
                        '       └─ b',
                        '          ├─ c',
                        '          │  └─ ▶ runnable1',
                        '          └─ d',
                        '             └─ ▶ runnable2'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '─ [[branch]]',
                        '    └─ a › b',
                        '       ├─ c',
                        '       │  └─ ▶ runnable1',
                        '       └─ d',
                        '          └─ ▶ runnable2'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on-aggressive'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // on-aggressive — c → runnable1 и d → runnable2 — каждый с одним
                        // ребёнком — должны схлопнуться в ▶ c › runnable1 и ▶ d › runnable2.
                        '─ [[branch]]',
                        '    └─ a › b',
                        '       ├─ ▶ c › runnable1',
                        '       └─ ▶ d › runnable2'
                    ], 'ascii дерево должно совпадать');
                });

            });

            suite('Ветвление сразу после точки компрессии (промежуточный узел с данными)', function () {

                const specs = new Map([
                    ['branch', [
                        { segments: ['a', 'x'], data: {} },
                        { segments: ['a', 'x', 'y'], data: {} },
                        // После первых двух specs узел x имеет данные и ровно одного ребёнка (лист),
                        // он может быть объединён с родителем a в 'a › x'.
                        { segments: ['a', 'x', 'z'], data: {} }
                        // Третья spec добавляет в x второго ребёнка, что делает сжатие после x некорректным,
                        // значит x — конец цепочки сжатий.
                        // Реализация должна уметь «разжимать» такой узел или откладывать решение.
                    ]]
                ]);

                test('компрессия off', function () {
                    // ничего особенного не происходит

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'off'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '─ [[branch]]',
                        '    └─ a',
                        '       └─ ▶ x',
                        '          ├─ ▶ y',
                        '          └─ ▶ z'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {
                    // промежуточный 'a' сливается

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // нечего сжимать:
                        // в "on" лист не может стать частью сжатия
                        '─ [[branch]]',
                        '    └─ a',
                        '       └─ ▶ x',
                        '          ├─ ▶ y',
                        '          └─ ▶ z'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on-aggressive'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // максимальное сжатие: три узла
                        '─ [[branch]]',
                        '    └─ ▶ a › x',
                        '       ├─ ▶ y',
                        '       └─ ▶ z',
                    ], 'ascii дерево должно совпадать');
                });
            });

            suite('Чередование данных в цепочке', function () {
                // Если в цепочке A → B → C → D данные есть у B и у D,
                // компрессия узлов должна остановиться на B, чтобы не потерять её данные

                const specs = new Map([
                    ['branch', [
                        { segments: ['A', 'B'], data: {} },
                        { segments: ['A', 'B', 'C', 'D'], data: {} },
                    ]]
                ]);

                test('компрессия off', function () {
                    // ничего особенного не происходит

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'off'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '─ [[branch]]',
                        '    └─ A',
                        '       └─ ▶ B',
                        '          └─ C',
                        '             └─ ▶ D'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {
                    //

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // сжимать нечего, лист - всегда отдельный узел,
                        // не участвующий в сжатии
                        '─ [[branch]]',
                        '    └─ A',
                        '       └─ ▶ B',
                        '          └─ C',
                        '             └─ ▶ D'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {
                    //

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on-aggressive'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // A+B слиты (у A нет данных), C+D слиты (у C нет данных),
                        // но два получившихся узла не слиты друг с другом, т.к. каждый несет свои данные.
                        '─ [[branch]]',
                        '    └─ ▶ A › B',
                        '       └─ ▶ C › D'
                    ], 'ascii дерево должно совпадать');
                });

            });

            suite('Чередование данных в цепочке, плюс промежуточный уровень', function () {

                const specs = new Map([
                    ['branch', [
                        { segments: ['A', 'B'], data: {} },
                        { segments: ['A', 'B', 'C', 'D', 'E'], data: {} },
                    ]]
                ]);

                test('компрессия off', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'off'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // ничего особенного не происходит
                        '─ [[branch]]',
                        '    └─ A',
                        '       └─ ▶ B',
                        '          └─ C',
                        '             └─ D',
                        '                └─ ▶ E'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {
                    //

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // только "не значащий" промежуток C→D сжат
                        '─ [[branch]]',
                        '    └─ A',
                        '       └─ ▶ B',
                        '          └─ C › D',
                        '             └─ ▶ E'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {
                    //

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on-aggressive'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // все сжато до двух узлов
                        '─ [[branch]]',
                        '    └─ ▶ A › B',
                        '       └─ ▶ C › D › E'
                    ], 'ascii дерево должно совпадать');
                });

            });

            suite('Сегмент, содержащий пустую строку', function () {
                // ничего особенного не происходит

                const specs = new Map([
                    ['branch', [
                        { segments: ['a', '', 'b'], data: {} }
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
                        '       └─ ',
                        '          └─ ▶ b'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '─ [[branch]]',
                        '    └─ a › ',
                        '       └─ ▶ b'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on-aggressive'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '─ [[branch]]',
                        '    └─ ▶ a ›  › b',
                    ], 'ascii дерево должно совпадать');
                });
            });

        });
    });
});
