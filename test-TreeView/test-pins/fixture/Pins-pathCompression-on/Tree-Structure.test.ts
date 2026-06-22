import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Pins', function () {

    suite('Tree Structure', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('Pins иерархия — `pathCompression = on`', async function () {
            // Pinned с глубокой иерархией — pathCompression = 'on'
            // Проверяет: однодетные цепочки группа→группа схлопываются (BBB › CCC, DDD › EEE, FFF › GGG),
            // цепочки группа→задача не схлопываются (side-FFF/task3, side-DDD/task4, side-BBB/task5).
            //
            // Задействованные настройки: segmentSeparator=":", compressionBehavior="NORMAL".

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[★[ Pins ]]                      ',
                    '  └─ AAA                            ',
                    '     ├─ BBB › CCC                   ',
                    '     │  ├─ DDD › EEE                ',
                    '     │  │  ├─ FFF › GGG             ',
                    '     │  │  │  ├─ ▶ task-G1          ',
                    '     │  │  │  └─ ▶ task-G2          ',
                    '     │  │  └─ side-FFF              ',
                    '     │  │     └─ ▶ task3            ',
                    '     │  └─ side-DDD                 ',
                    '     │     └─ ▶ task4               ',
                    '     └─ side-BBB                    ',
                    '        └─ ▶ task5                  ',
                    '━[F[ Pins-pathCompression-on ]]     ',
                    '  └─ AAA                            ',
                    '     ├─ BBB                         ',
                    '     │  └─ CCC                      ',
                    '     │     ├─ DDD                   ',
                    '     │     │  └─ EEE                ',
                    '     │     │     ├─ FFF             ',
                    '     │     │     │  └─ GGG          ',
                    '     │     │     │     ├─ ▶ task-G1 ',
                    '     │     │     │     └─ ▶ task-G2 ',
                    '     │     │     └─ side-FFF        ',
                    '     │     │        └─ ▶ task3      ',
                    '     │     └─ side-DDD              ',
                    '     │        └─ ▶ task4            ',
                    '     └─ side-BBB                    ',
                    '        └─ ▶ task5                  '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
