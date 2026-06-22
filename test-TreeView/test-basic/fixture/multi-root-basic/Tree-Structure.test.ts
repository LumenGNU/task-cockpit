import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('Basic', function () {

    suite('Multi-root', function () {

        suite('Tree Structure', function () {

            suiteSetup(async function () {
                const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
                assert.ok(ext);
                await ext.activate();
            });

            test('multi-root workspace, несколько папок — структура правильна', async function () {
                // Multi-root workspace: несколько папок.
                // Проверяет изоляцию задач по scope

                const result = await vscode.commands.executeCommand<string>(
                    'taskCockpit.test.getTreeStructure'
                );

                assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

                assert.strictEqual(result,
                    [
                        '━[F[ multi-root-basic (Workspace) ]]  ',
                        '  └─ ▶ task-in-workspace              ',
                        '━[F[ folder1 ]]                       ',
                        '  ├─ ▶ task1-in-folder1               ',
                        '  ├─ ▶ task2-in-folder1               ',
                        '  └─ ▶ task3-in-folder1               ',
                        '━[F[ folder2 ]]                       ',
                        '  └─ ▶ task-in-folder2                '
                    ].map(s => s.trimEnd()).join('\n')
                );

            });
        });
    });
});
