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
            // - в NORMAL-режиме path compression не «втягивает» Runnable Parent
            //   в сжатую строку предков — иначе его путь не совпадёт с путём ребёнка
            //   и они окажутся в разных ветках дерева (дубль вместо вложенности).

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[★[ Pins ]]                    ',
                    '  └─ AAA › BBB                    ',
                    '     └─ ▶ Runnable Parent        ',
                    '        └─ ▶ Sub Task            ',
                    '━[F[ Pins-has-child-on ]]        ',
                    '  └─ AAA                         ',
                    '     └─ BBB                      ',
                    '        └─ ▶ Runnable Parent     ',
                    '           └─ ▶ Sub Task         '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
