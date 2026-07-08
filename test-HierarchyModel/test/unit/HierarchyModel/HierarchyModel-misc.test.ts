import * as assert from 'node:assert/strict';
import HierarchyModel from 'src/HierarchyModel/HierarchyModel';
import buildAsciiTree from '../buildAsciiTree';


suite('HierarchyModel', function () {

    suite('buildHierarchy', function () {

        // Разные тесты на структуру

        suite('Неадекватно глубокая вложенность', function () {

            const specs = new Map([
                ['branch', [
                    { segments: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'x', 'y', 'z', 'runnable-2'], data: {} },
                    { segments: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'x', 'y', 'z', 'runnable-3'], data: {} },
                    { segments: ['S', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'x', 'y', 'z', 'runnable-1'/*намеренно*/], data: {} },
                    { segments: ['a', 'b', 'c', 'd', 'e', 'g', 'h', 'runnable-4'], data: {} },
                    { segments: ['x', 'y', 'z', 'runnable-5'], data: {} },
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
                    '    ├─ a',
                    '    │  └─ b',
                    '    │     └─ c',
                    '    │        └─ d',
                    '    │           └─ e',
                    '    │              ├─ f',
                    '    │              │  └─ g',
                    '    │              │     └─ h',
                    '    │              │        └─ k',
                    '    │              │           └─ l',
                    '    │              │              └─ m',
                    '    │              │                 └─ n',
                    '    │              │                    └─ o',
                    '    │              │                       └─ p',
                    '    │              │                          └─ r',
                    '    │              │                             └─ s',
                    '    │              │                                └─ t',
                    '    │              │                                   └─ x',
                    '    │              │                                      └─ y',
                    '    │              │                                         └─ z',
                    '    │              │                                            ├─ ▶ runnable-2',
                    '    │              │                                            └─ ▶ runnable-3',
                    '    │              └─ g',
                    '    │                 └─ h',
                    '    │                    └─ ▶ runnable-4',
                    '    ├─ S',
                    '    │  └─ a',
                    '    │     └─ b',
                    '    │        └─ c',
                    '    │           └─ d',
                    '    │              └─ e',
                    '    │                 └─ f',
                    '    │                    └─ g',
                    '    │                       └─ h',
                    '    │                          └─ k',
                    '    │                             └─ l',
                    '    │                                └─ m',
                    '    │                                   └─ n',
                    '    │                                      └─ o',
                    '    │                                         └─ p',
                    '    │                                            └─ r',
                    '    │                                               └─ s',
                    '    │                                                  └─ t',
                    '    │                                                     └─ x',
                    '    │                                                        └─ y',
                    '    │                                                           └─ z',
                    '    │                                                              └─ ▶ runnable-1',
                    '    └─ x',
                    '       └─ y',
                    '          └─ z',
                    '             └─ ▶ runnable-5',
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
                    '    ├─ a › b › c › d › e',
                    '    │  ├─ f › g › h › k › l › m › n › o › p › r › s › t › x › y › z',
                    '    │  │  ├─ ▶ runnable-2',
                    '    │  │  └─ ▶ runnable-3',
                    '    │  └─ g › h',
                    '    │     └─ ▶ runnable-4',
                    '    ├─ S › a › b › c › d › e › f › g › h › k › l › m › n › o › p › r › s › t › x › y › z',
                    '    │  └─ ▶ runnable-1',
                    '    └─ x › y › z',
                    '       └─ ▶ runnable-5'
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
                    '    ├─ a › b › c › d › e',
                    '    │  ├─ f › g › h › k › l › m › n › o › p › r › s › t › x › y › z',
                    '    │  │  ├─ ▶ runnable-2',
                    '    │  │  └─ ▶ runnable-3',
                    '    │  └─ ▶ g › h › runnable-4',
                    '    ├─ ▶ S › a › b › c › d › e › f › g › h › k › l › m › n › o › p › r › s › t › x › y › z › runnable-1',
                    '    └─ ▶ x › y › z › runnable-5',
                ], 'ascii дерево должно совпадать');
            });
        });


        suite('Каждый элемент получает данные уже после объявления', function () {

            const specs = new Map([
                ['branch', [
                    // сначала все узлы объявляются как промежуточные
                    { segments: ['x', 'y', 'z', 'φ'], data: {} },
                    // потом каждый узел получает данные — становится "листом-с-данными" (runnable-узлом)
                    { segments: ['x', 'y', 'z'], data: {} },
                    { segments: ['x', 'y'], data: {} },
                    { segments: ['x'], data: {} },
                ]]
            ]);
            // Получится дерево которое невозможно сжать: каждый узел — runnable-узел.
            // Порядок — в порядке первого объявления: x→y→z→φ

            test('компрессия off', function () {

                const hierarchy = HierarchyModel.buildHierarchy(
                    specs,
                    'off'
                );

                const lines = buildAsciiTree(hierarchy);

                assert.deepEqual(lines, [
                    '─ [[branch]]',
                    '    └─ ▶ x',
                    '       └─ ▶ y',
                    '          └─ ▶ z',
                    '             └─ ▶ φ',
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
                    '    └─ ▶ x',
                    '       └─ ▶ y',
                    '          └─ ▶ z',
                    '             └─ ▶ φ',
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
                    '    └─ ▶ x',
                    '       └─ ▶ y',
                    '          └─ ▶ z',
                    '             └─ ▶ φ',
                ], 'ascii дерево должно совпадать');
            });
        });

    });
});
