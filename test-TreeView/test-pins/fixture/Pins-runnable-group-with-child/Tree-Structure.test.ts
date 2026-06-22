import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Pins', function () {

    suite('Tree Structure', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('закреплённый узел, который одновременно является родителем другого закреплённого узла', async function () {
            // Закреплённый узел, который одновременно является родителем другого закреплённого узла.
            //
            // Проверяем:
            // - в "on-aggressive"-режиме `Runnable Parent` трактуется как forced branch point:
            //  сжимается вместе с предками в один сегмент, а ребёнок правильно вкладывается под него.

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[★[ Pins ]]                            ',
                    '  └─ ▶ AAA › BBB › Runnable Parent         ',
                    '     └─ ▶ Sub Task                      ',
                    '━[F[ Pins-runnable-group-with-child ]]  ',
                    '  └─ AAA                                ',
                    '     └─ BBB                             ',
                    '        └─ ▶ Runnable Parent            ',
                    '           └─ ▶ Sub Task                '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
