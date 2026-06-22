import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Pins', function () {

    suite('Tree Structure', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('секция Pins скрыта при наличии пинов и `pins.visibility = false`', async function () {
            // Pinned: single-folder, visibility=HIDE.
            // Проверяет: секция Pinned скрыта при наличии живых refs (HIDE).
            // Рабочие refs есть — раздел не отображается.

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ Pins-visibility-false ]]   ',
                    '  ├─ ▶ task-1 ',
                    '  ├─ ▶ task-2 ',
                    '  └─ ▶ task-3 '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
