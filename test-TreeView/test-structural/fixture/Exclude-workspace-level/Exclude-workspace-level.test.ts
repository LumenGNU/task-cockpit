import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('Tree scenarios', function () {

    suite('Exclude', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('исключенная workspace scope’а не видна в дереве', async function () {

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ folder1 ]]     ', // workspace исключена
                    '  └─ ▶ in-folder1   ',
                    '━[F[ folder2 ]]     ',
                    '  └─ ▶ in-folder2   ',
                    '━[F[ folder3 ]]     ',
                    '  └─ ▶ in-folder3   '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
