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

        suite('Граничные случаи', function () {


            suite('Пустая карта (ничего)', function () {

                const specsDict = {
                    branchKey: 'K',
                    specs: []
                };

                test('компрессия off', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        'off'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // ничего
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        'on'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // ничего
                    ], 'ascii дерево должно совпадать');
                });

                test('компрессия on-aggressive', function () {

                    const hierarchy = HierarchyModel.buildHierarchy(
                        specsDict,
                        'on-aggressive'
                    );

                    const lines = buildAsciiTree(hierarchy);

                    assert.deepEqual(lines, [
                        // ничего
                    ], 'ascii дерево должно совпадать');
                });

            });


            suite('Пустой массив сегментов (нет пути)', function () {

                const specsDict = {
                    branchKey: 'branch',
                    specs: [
                        { segments: [], data: {} }
                    ]
                };

                test('компрессия off', function () {

                    assert.throws(
                        () => {
                            // выбросит исключение: ошибка входных данных
                            HierarchyModel.buildHierarchy(
                                specsDict,
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
