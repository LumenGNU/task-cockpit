import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios', function () {

    suite('Hidden', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('скрытые задачи не отображаются при `showHidden=false`', async function () {

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ Hidden-show-hidden-false ]]         ',
                    '  ├─ AAA              ',
                    '  │  └─ ▶ visible     ',
                    '  ├─ BBB              ',
                    '  │  └─ CCC           ',
                    '  │     └─ ▶ visible  ',
                    '  └─ FFF              ',
                    '     └─ segment&task  ', // не задача, только группа
                    '        └─ ▶ visible  '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
