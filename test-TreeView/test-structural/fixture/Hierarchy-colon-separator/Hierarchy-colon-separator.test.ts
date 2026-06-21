import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios', function () {

    suite('Hierarchy', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('базовая иерархия через separator', async function () {

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ Hierarchy-colon-separator ]]       ',
                    '  ├─ AAA            ',
                    '  │  ├─ ▶ in-aaa-1  ',
                    '  │  └─ ▶ in-aaa-2  ',
                    '  ├─ BBB            ',
                    '  │  ├─ ▶ in-bbb-1  ',
                    '  │  └─ ▶ in-bbb-2  ',
                    '  └─ ▶ ccc          '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
