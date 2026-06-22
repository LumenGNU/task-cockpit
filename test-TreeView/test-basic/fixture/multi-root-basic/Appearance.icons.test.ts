import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import Element from 'src/TreeDataProvider/Element';

type FlatItem = {
    element: Element;
    item: vscode.TreeItem;
    depth: number;
};

suite('Basic', function () {

    suite('Multi-root', function () {

        suite('Appearance', function () {

            suiteSetup(async function () {
                const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
                assert.ok(ext);
                await ext.activate();
            });

            test('multi-root workspace, несколько папок — задачи получили значки из своих определений', async function () {
                // Multi-root workspace: несколько папок.
                // Проверяет
                // - изоляцию задач по scope.
                // - каждый runnable узел получает значок из определения

                const result = await vscode.commands.executeCommand<FlatItem[]>(
                    'taskCockpit.test.getFlatItems'
                );
                assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

                const expectedNodes = [
                    {
                        label: 'task-in-workspace',
                        iconPath: { id: 'zap' }
                    },
                    {
                        label: 'task1-in-folder1',
                        iconPath: { id: 'tools' } // получит по умолчанию
                    },
                    {
                        label: 'task2-in-folder1',
                        iconPath: { id: 'zap' }
                    },
                    {
                        label: 'task3-in-folder1',
                        iconPath: { id: 'rocket' }
                    },
                    {
                        label: 'task-in-folder2',
                        iconPath: { id: 'package' }
                    }
                ];

                expectedNodes.forEach(function (expected) {
                    const { label } = expected;
                    const found = result.find(function (flat) {
                        return flat.item.label === label;
                    });
                    assert.ok(found, `ожидался узел «${label}»`);

                    const treeItem = found.item;
                    const icon = treeItem.iconPath;
                    assert.ok(icon);
                    assert.ok(icon instanceof vscode.ThemeIcon, `иконка узла «${label}» не является ThemeIcon`);
                    assert.deepEqual(icon.id, expected.iconPath.id, `для «${label}» ожидался значок «${expected.iconPath.id}», получен «${icon.id}»`);
                });
            });
        });
    });
});
