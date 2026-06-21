import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios. Structural', function () {

    suite('Flat basic (B-C-A order)', function () {

        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('плоский список без иерархии (другой порядок)', async function () {

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ Flat-basic-(B-C-A_order) ]]',
                    '  ├─ ▶ BBB',
                    '  ├─ ▶ CCC',
                    '  └─ ▶ AAA'
                ].join('\n')
            );

        });
    });
});
