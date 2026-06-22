import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios', function () {

    suite('Hierarchy', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('useGroupKind отключена, есть задачи с группою — срабатывает только сепаратор', async function () {
            //

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ group-kind-disabled ]]           ',
                    '  ├─ Build                ',
                    '  │  ├─ ▶ child-task-1    ',
                    '  │  └─ ▶ child-task-2    ',
                    '  ├─ deploy               ',
                    '  │  ├─ ▶ child-task-1    ',
                    '  │  └─ ▶ child-task-2    ',
                    '  └─ AAA                  ',
                    '     └─ ▶ child-task-1    '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
