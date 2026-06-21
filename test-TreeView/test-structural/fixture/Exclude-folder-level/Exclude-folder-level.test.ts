import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('Tree scenarios', function () {

    suite('Exclude', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('исключенные папки проект не видны в дереве', async function () {

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ Exclude-folder-level (Workspace) ]]     ', // папка folder2 исключена
                    '  └─ « No tasks to display in this scope »   ',
                    '━[F[ folder1 ]]                              ',
                    '  └─ ▶ in-folder1                            ',
                    '━[F[ folder3 ]]                              ',
                    '  └─ ▶ in-folder3                            '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
