import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Tree scenarios', function () {

    suite('Pins', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('pins.visibility="false" — секция Pins не отображается даже если есть закрепленные задачи', async function () {

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    // задача закреплена, но pins.visibility="false" - секции Pins нет вообще
                    '━[F[ Pins-not-visible-off ]]         ',
                    '  └─ ▶ pinned                    ',
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
