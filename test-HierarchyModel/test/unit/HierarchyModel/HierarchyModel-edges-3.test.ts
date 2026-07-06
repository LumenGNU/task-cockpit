import * as assert from 'node:assert/strict';
import HierarchyModel from 'src/HierarchyModel/HierarchyModel';
import buildTree from '../buildTree';


suite('HierarchyModel', function () {

    suite('buildHierarchy', function () {

        suite('Граничные случаи', function () {


            suite('Пустой список specs (нет структуры)', function () {

                const specs: HierarchyModel.Specs<{}> = [];

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
                        // ничего
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
                        // ничего
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
                        // ничего
                    ], 'ascii дерево должно совпадать');
                });

            });

            suite('Пустой массив сегментов (нет пути)', function () {

                const specs = [
                    { segments: [], data: {} }
                ];

                test('компрессия off', function () {

                    assert.throws(
                        () => {
                            // выбросит исключение: ошибка входных данных
                            HierarchyModel.buildHierarchy(
                                { branchPrefix: 'pref', branchKey: 'key', specs },
                                'off'
                            );
                        },
                        {
                            name: 'AssertionError',
                            message: /path must contain at least one segment/
                        }
                    );

                });

            });

        });
    });
});
