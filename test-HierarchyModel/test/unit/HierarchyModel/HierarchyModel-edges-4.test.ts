import * as assert from 'node:assert/strict';
import HierarchyModel from 'src/HierarchyModel/HierarchyModel';
import buildTree from '../buildTree';


suite('HierarchyModel', function () {

    suite('buildHierarchy', function () {

        suite('Граничные случаи', function () {

            suite('Сегменты à la "числа" — порядок сохраняется', function () {

                const specs = [
                    { segments: ['3', '1', '2'], data: {} },
                    { segments: ['3', '2', '1'], data: {} },
                    { segments: ['1', '2', '3'], data: {} }
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
                        '─ 3',
                        '  ├─ 1',
                        '  │  └─ ▶ 2',
                        '  └─ 2',
                        '     └─ ▶ 1',
                        '─ 1',
                        '  └─ 2',
                        '     └─ ▶ 3'
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
                        '─ 3',
                        '  ├─ 1',
                        '  │  └─ ▶ 2',
                        '  └─ 2',
                        '     └─ ▶ 1',
                        '─ 1 › 2',
                        '  └─ ▶ 3'
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
                        '─ 3',
                        '  ├─ ▶ 1 › 2',
                        '  └─ ▶ 2 › 1',
                        '─ ▶ 1 › 2 › 3'
                    ], 'ascii дерево должно совпадать');
                });
            });

            suite('Дублирующиеся пути — последний выиграет', function () {

                // Если несколько спецификаций с одинаковым путём, побеждает
                // последняя (её данные перезаписывают предыдущие).

                const winner = 42;

                const specs = [
                    { segments: ['aaa', 'bbb', 'runnable'], data: { value: 1 } },
                    { segments: ['aaa', 'bbb', 'runnable'], data: { value: winner } },
                ];

                test('последний выиграет', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        {
                            branchPrefix: 'pref',
                            branchKey: 'key',
                            specs
                        },
                        'off'
                    );

                    const runnable = hierarchy.get('aaa')?.children?.get('bbb')?.children?.get('runnable');
                    assert.ok(runnable);
                    assert.ok(runnable.data);
                    assert.equal(winner, runnable.data.value);

                });

            });

            suite('Повторяющиеся сегменты в одном пути', function () {

                // Пути с одинаковыми именами на разных уровнях — обрабатываются без конфликтов.

                const specs = [
                    { segments: ['aaa', 'aaa', 'bbb', 'aaa', 'runnable'], data: {} },
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
                        '─ aaa',
                        '  └─ aaa',
                        '     └─ bbb',
                        '        └─ aaa',
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

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        '─ aaa › aaa › bbb › aaa',
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

                    const lines = buildTree([...hierarchy.values()], '', true);

                    assert.deepEqual(lines, [
                        '─ ▶ aaa › aaa › bbb › aaa › runnable'
                    ], 'ascii дерево должно совпадать');
                });

            });

        });
    });
});
