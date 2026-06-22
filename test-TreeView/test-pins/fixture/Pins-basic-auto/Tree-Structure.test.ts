import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Pins', function () {

    suite('Tree Structure', function () {

        suiteSetup(async function () {

            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();

        });

        test('секция Pins появляется при наличии пинов', async function () {
            // Pinned: single-folder, visibility=AUTO.
            // Проверяет:
            // - секция Pinned появляется при наличии refs (AUTO)
            // - корректное разрешение ref'ов в дереве
            // - порядок Pinned соответствует порядку в массиве refs (не порядку задач в файле)
            //
            // Задействованные настройки: segmentSeparator=":" (иерархия по сегментам).


            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[★[ Pins ]]    ',
                    '  ├─ ▶ lint      ',
                    '  ├─ test        ',
                    '  │  └─ ▶ e2e    ',
                    '  └─ build       ',
                    '     ├─ ▶ prod   ',
                    '     └─ ▶ dev    ',
                    '━[F[ Pins-basic-auto ]]      ',
                    '  ├─ build       ',
                    '  │  ├─ ▶ dev    ',
                    '  │  └─ ▶ prod   ',
                    '  ├─ test        ',
                    '  │  ├─ ▶ unit   ',
                    '  │  └─ ▶ e2e    ',
                    '  └─ ▶ lint      '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
