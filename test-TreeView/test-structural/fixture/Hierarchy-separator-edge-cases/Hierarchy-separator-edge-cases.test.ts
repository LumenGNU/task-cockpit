import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios', function () {

    suite('Hierarchy', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('separator edge cases', async function () {

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ Hierarchy-separator-edge-cases ]]       ',
                    '  ├─ AAA             ',
                    '  │  └─ ▶ in-aaa     ', // единственный сработавший разделитель
                    '  ├─ ▶ AAA//flat     ',
                    '  ├─ ▶ AAA /flat     ',
                    '  ├─ ▶ AAA flat/     ',
                    '  ├─ ▶ /FLAT         ',
                    '  ├─ ▶ FLAT/         ',
                    '  └─ ▶ /FLAT/        '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
