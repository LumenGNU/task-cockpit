import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Tree scenarios', function () {

    suite('Pins', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('порядок определяется порядком в pinned, а не структурой дерева', async function () {
            // Pins порядок отображения определяется порядком в pinned, а не структурой дерева.
            // Workspace: в tasks.json задачи определены в порядке child-task-A, потом child-task-B.
            //   Но закреплены в порядке child-task-B, потом child-task-A.
            //   В Pins они должны отображаться в порядке закрепления.
            // folder: обратный порядок — для симметричной проверки.
            //
            // Задействованные настройки: segmentSeparator=":", compressionBehavior="SMART".

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[★[ Pins ]]                         ',
                    '  ├─ Pins-order (Workspace)           ',
                    '  │  └─ parent                        ',
                    '  │     ├─ ▶ child-task-B             ', // порядок из pins
                    '  │     └─ ▶ child-task-A             ',
                    '  └─ folder                           ',
                    '     └─ parent                        ',
                    '        ├─ ▶ child-task-A             ', // порядок из pins
                    '        └─ ▶ child-task-B             ',
                    '━[F[ Pins-order (Workspace) ]]        ',
                    '  └─ parent                           ',
                    '     ├─ ▶ child-task-A                ',
                    '     └─ ▶ child-task-B                ',
                    '━[F[ folder ]]                        ',
                    '  └─ parent                           ',
                    '     ├─ ▶ child-task-B                ',
                    '     └─ ▶ child-task-A                ',
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
