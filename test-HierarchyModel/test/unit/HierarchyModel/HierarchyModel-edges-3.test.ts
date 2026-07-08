import * as assert from 'node:assert/strict';
import HierarchyModel from 'src/HierarchyModel/HierarchyModel';
import buildAsciiTree from '../buildAsciiTree';


suite('HierarchyModel', function () {

    suite('buildHierarchy', function () {

        suite('Граничные случаи', function () {


            suite('Пустая карта (ничего)', function () {

                const specs = new Map();

                test('компрессия off', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'off'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // ничего
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // ничего
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on-aggressive'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // ничего
                    ], 'ascii дерево должно совпадать');
                });

            });


            suite('Пустой specs (нет структуры)', function () {

                const specs = new Map([['branch', []]]);

                test('компрессия off', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'off'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '─ [[branch]]'
                        // ничего
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '─ [[branch]]'
                        // ничего
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specs,
                        'on-aggressive'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        '─ [[branch]]'
                        // ничего
                    ], 'ascii дерево должно совпадать');
                });

            });

            suite('Пустой массив сегментов (нет пути)', function () {

                const specs = new Map([
                    ['branch', [
                        { segments: [], data: {} }
                    ]]
                ]);

                test('компрессия off', function () {

                    assert.throws(
                        () => {
                            // выбросит исключение: ошибка входных данных
                            HierarchyModel.buildHierarchy(
                                specs,
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
