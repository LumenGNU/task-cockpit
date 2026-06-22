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
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ separator-disabled ]]       ',
                    "  ├─ ▶ AAA:in-aaa-1 ",
                    "  ├─ ▶ AAA:in-aaa-2 ",
                    "  ├─ ▶ BBB:in-bbb-1 ",
                    "  ├─ ▶ BBB:in-bbb-2 ",
                    "  └─ ▶ ccc          "
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
