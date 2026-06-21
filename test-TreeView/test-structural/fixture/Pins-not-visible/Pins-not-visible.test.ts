import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Tree scenarios', function () {

    suite('Pins', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('секция Pins не отображается если нет закрепленных задач', async function () {

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    // нет закрепленных задач - секции Pins нет вообще
                    '━[F[ Pins-not-visible ]]         ',
                    '  └─ ▶ not-pinned                ',
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
