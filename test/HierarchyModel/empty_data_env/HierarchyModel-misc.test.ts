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

        // Разные тесты на структуру

        suite('Неадекватно глубокая вложенность', function () {

            const specsDict = {
                branchKey: 'branch',
                specs: [
                    { segments: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'x', 'y', 'z', 'runnable-2'], data: {} },
                    { segments: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'x', 'y', 'z', 'runnable-3'], data: {} },
                    { segments: ['S', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'x', 'y', 'z', 'runnable-1'/*намеренно*/], data: {} },
                    { segments: ['a', 'b', 'c', 'd', 'e', 'g', 'h', 'runnable-4'], data: {} },
                    { segments: ['x', 'y', 'z', 'runnable-5'], data: {} },
                ]
            };

            test('компрессия off', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specsDict,
                    HierarchyModel.PathCompression.OFF
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '├─ a',
                    '│  └─ b',
                    '│     └─ c',
                    '│        └─ d',
                    '│           └─ e',
                    '│              ├─ f',
                    '│              │  └─ g',
                    '│              │     └─ h',
                    '│              │        └─ k',
                    '│              │           └─ l',
                    '│              │              └─ m',
                    '│              │                 └─ n',
                    '│              │                    └─ o',
                    '│              │                       └─ p',
                    '│              │                          └─ r',
                    '│              │                             └─ s',
                    '│              │                                └─ t',
                    '│              │                                   └─ x',
                    '│              │                                      └─ y',
                    '│              │                                         └─ z',
                    '│              │                                            ├─ ▶ runnable-2',
                    '│              │                                            └─ ▶ runnable-3',
                    '│              └─ g',
                    '│                 └─ h',
                    '│                    └─ ▶ runnable-4',
                    '├─ S',
                    '│  └─ a',
                    '│     └─ b',
                    '│        └─ c',
                    '│           └─ d',
                    '│              └─ e',
                    '│                 └─ f',
                    '│                    └─ g',
                    '│                       └─ h',
                    '│                          └─ k',
                    '│                             └─ l',
                    '│                                └─ m',
                    '│                                   └─ n',
                    '│                                      └─ o',
                    '│                                         └─ p',
                    '│                                            └─ r',
                    '│                                               └─ s',
                    '│                                                  └─ t',
                    '│                                                     └─ x',
                    '│                                                        └─ y',
                    '│                                                           └─ z',
                    '│                                                              └─ ▶ runnable-1',
                    '└─ x',
                    '   └─ y',
                    '      └─ z',
                    '         └─ ▶ runnable-5',
                ], 'ascii дерево должно совпадать');
            });

            test('компрессия on', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specsDict,
                    HierarchyModel.PathCompression.ON
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '├─ a › b › c › d › e',
                    '│  ├─ f › g › h › k › l › m › n › o › p › r › s › t › x › y › z',
                    '│  │  ├─ ▶ runnable-2',
                    '│  │  └─ ▶ runnable-3',
                    '│  └─ g › h',
                    '│     └─ ▶ runnable-4',
                    '├─ S › a › b › c › d › e › f › g › h › k › l › m › n › o › p › r › s › t › x › y › z',
                    '│  └─ ▶ runnable-1',
                    '└─ x › y › z',
                    '   └─ ▶ runnable-5'
                ], 'ascii дерево должно совпадать');
            });

            test('компрессия on-aggressive', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specsDict,
                    HierarchyModel.PathCompression.ON_AGGRESSIVE
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '├─ a › b › c › d › e',
                    '│  ├─ f › g › h › k › l › m › n › o › p › r › s › t › x › y › z',
                    '│  │  ├─ ▶ runnable-2',
                    '│  │  └─ ▶ runnable-3',
                    '│  └─ ▶ g › h › runnable-4',
                    '├─ ▶ S › a › b › c › d › e › f › g › h › k › l › m › n › o › p › r › s › t › x › y › z › runnable-1',
                    '└─ ▶ x › y › z › runnable-5',
                ], 'ascii дерево должно совпадать');
            });
        });


        suite('Каждый элемент получает данные уже после объявления', function () {

            const specsDict = {
                branchKey: 'branch',
                specs: [
                    // сначала все узлы объявляются как промежуточные
                    { segments: ['x', 'y', 'z', 'φ'], data: {} },
                    // потом каждый узел получает данные — становится "листом-с-данными" (runnable-узлом)
                    { segments: ['x', 'y', 'z'], data: {} },
                    { segments: ['x', 'y'], data: {} },
                    { segments: ['x'], data: {} },
                ]
            };
            // Получится дерево которое невозможно сжать: каждый узел — runnable-узел.
            // Порядок — в порядке первого объявления: x→y→z→φ

            test('компрессия off', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specsDict,
                    HierarchyModel.PathCompression.OFF
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '└─ ▶ x',
                    '   └─ ▶ y',
                    '      └─ ▶ z',
                    '         └─ ▶ φ',
                ], 'ascii дерево должно совпадать');
            });

            test('компрессия on', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specsDict,
                    HierarchyModel.PathCompression.ON
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '└─ ▶ x',
                    '   └─ ▶ y',
                    '      └─ ▶ z',
                    '         └─ ▶ φ',
                ], 'ascii дерево должно совпадать');
            });

            test('компрессия on-aggressive', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specsDict,
                    HierarchyModel.PathCompression.ON_AGGRESSIVE
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '└─ ▶ x',
                    '   └─ ▶ y',
                    '      └─ ▶ z',
                    '         └─ ▶ φ',
                ], 'ascii дерево должно совпадать');
            });
        });

    });
});
