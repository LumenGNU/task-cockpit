import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Tree scenarios', function () {

    suite('Pins', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('Pins иерархия — `pathCompression = on-aggressive`', async function () {
            // Pinned с глубокой иерархией — path compression, режим on-aggressive.
            // Проверяет: схлопываются и цепочки группа→группа (BBB › CCC, DDD › EEE, FFF › GGG),
            // и цепочки группа→задача (side-FFF › task3, side-DDD › task4, side-BBB › task5).
            //
            // Задействованные настройки: segmentSeparator=":", compressionBehavior="on-aggressive".

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    "━[★[ Pins ]]                                ",
                    "  └─ AAA                                      ",
                    "     ├─ BBB › CCC                             ",
                    "     │  ├─ DDD › EEE                          ",
                    "     │  │  ├─ FFF › GGG                       ",
                    "     │  │  │  ├─ ▶ task-G1                    ",
                    "     │  │  │  └─ ▶ task-G2                    ",
                    "     │  │  └─ ▶ side-FFF › task3              ",
                    "     │  └─ ▶ side-DDD › task4                 ",
                    "     └─ ▶ side-BBB › task5                    ",
                    "━[F[ Pins-pathCompression-on-aggressive ]]   ",
                    "  └─ AAA                                     ",
                    "     ├─ BBB                                  ",
                    "     │  └─ CCC                               ",
                    "     │     ├─ DDD                            ",
                    "     │     │  └─ EEE                         ",
                    "     │     │     ├─ FFF                      ",
                    "     │     │     │  └─ GGG                   ",
                    "     │     │     │     ├─ ▶ task-G1          ",
                    "     │     │     │     └─ ▶ task-G2          ",
                    "     │     │     └─ side-FFF                 ",
                    "     │     │        └─ ▶ task3               ",
                    "     │     └─ side-DDD                       ",
                    "     │        └─ ▶ task4                     ",
                    "     └─ side-BBB                             ",
                    "        └─ ▶ task5                           "
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
