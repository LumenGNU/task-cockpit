import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Tree scenarios', function () {

    suite('Pins', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('задача внутри group-kind ветки закреплена — Group-kind ветка участвует в компрессии пути', async function () {
            //  задача внутри group-kind ветки попадает в Pinned — Group-kind ветка участвует в компрессии,
            // если "useGroupKind": true. (как и любой другой сегмент)

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[★[ Pins ]]       ',
                    '  └─ Build › ci      ',
                    '     └─ ▶ lint     ',
                    '━[F[ Pins-with-group ]]        ',
                    '  ├─ Build         ',
                    '  │  └─ ci         ',
                    '  │     └─ ▶ lint  ',
                    '  └─ ▶ task        '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
