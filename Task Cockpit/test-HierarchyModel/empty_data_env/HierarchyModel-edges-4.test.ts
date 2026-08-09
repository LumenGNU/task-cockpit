import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import HierarchyModel from '../../src/HierarchyModel/HierarchyModel';
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

        suite('Граничные случаи', function () {

            suite('Сегменты à la "числа" — порядок сохраняется', function () {

                const specsDict = {
                    branchKey: 'branch',
                    specs: [
                        { segments: ['3', '1', '2'], data: {} },
                        { segments: ['3', '2', '1'], data: {} },
                        { segments: ['1', '2', '3'], data: {} }
                    ]
                };


                test('компрессия off', function () {
                    // ничего особенного не происходит

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        'off'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '├─ 3',
                        '│  ├─ 1',
                        '│  │  └─ ▶ 2',
                        '│  └─ 2',
                        '│     └─ ▶ 1',
                        '└─ 1',
                        '   └─ 2',
                        '      └─ ▶ 3'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {
                    //

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        'on'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '├─ 3',
                        '│  ├─ 1',
                        '│  │  └─ ▶ 2',
                        '│  └─ 2',
                        '│     └─ ▶ 1',
                        '└─ 1 › 2',
                        '   └─ ▶ 3'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {
                    //

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        'on-aggressive'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '├─ 3',
                        '│  ├─ ▶ 1 › 2',
                        '│  └─ ▶ 2 › 1',
                        '└─ ▶ 1 › 2 › 3'
                    ], 'ascii дерево должно совпадать');
                });
            });


            suite('Дублирующиеся пути — последний выиграет', function () {

                // Если несколько спецификаций с одинаковым путём, побеждает
                // последняя (её данные перезаписывают предыдущие).


                const specsDict = {
                    branchKey: 'branch',
                    specs: [
                        { segments: ['aaa', 'bbb', 'runnable'], data: { value: 'looser' } },
                        { segments: ['aaa', 'bbb', 'runnable'], data: { value: 'winner' } },
                    ]
                };

                test('последний выиграет', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        'off'
                    );

                    const runnable = hierarchy.children[0]?.children?.[0]?.children?.[0];
                    assert.ok(runnable);
                    assert.equal(runnable.label, 'runnable');
                    assert.ok(runnable.data);
                    assert.equal(runnable.data.value, 'winner');

                });

            });


            suite('Повторяющиеся сегменты в одном пути', function () {

                // Пути с одинаковыми именами на разных уровнях — обрабатываются без конфликтов.

                const specsDict = {
                    branchKey: 'branch',
                    specs: [
                        { segments: ['aaa', 'aaa', 'bbb', 'aaa', 'runnable'], data: {} },
                    ]
                };

                test('компрессия off', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        'off'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '└─ aaa',
                        '   └─ aaa',
                        '      └─ bbb',
                        '         └─ aaa',
                        '            └─ ▶ runnable'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        'on'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '└─ aaa › aaa › bbb › aaa',
                        '   └─ ▶ runnable'
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        'on-aggressive'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '└─ ▶ aaa › aaa › bbb › aaa › runnable'
                    ], 'ascii дерево должно совпадать');
                });

            });

        });
    });
});
