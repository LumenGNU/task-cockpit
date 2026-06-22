import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Pins', function () {

    suite('Tree Structure', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('нет фантомного сегмента при pathCompression = "on-aggressive"', async function () {
            // BUG: (решено) buildCompressedPath
            // Без guard'а reverseAndJoin() породит фантомный пустой сегмент.

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[★[ Pins ]]                                              ',
                    '  ├─ Pins-no-phantom-segment-on-aggressive (Workspace)     ',
                    '  │  └─ aaa › bbb › ccc                                       ',
                    '  │     ├─ ▶ ddd › task-in-ddd                              ', // BUG`а нет
                    '  │     └─ ▶ task-in-ccc                                   ',
                    '  └─ folder                                                ',
                    '     └─ aaa › bbb › ccc                                       ',
                    '        ├─ ▶ task-in-ccc                                   ',
                    '        └─ ▶ ddd › task-in-ddd                              ', // BUG`а нет
                    '━[F[ Pins-no-phantom-segment-on-aggressive (Workspace) ]] ',
                    '  └─ aaa                                       ',
                    '     └─ bbb                                    ',
                    '        └─ ccc                                 ',
                    '           ├─ ▶ task-in-ccc                    ',
                    '           └─ ddd                              ',
                    '              └─ ▶ task-in-ddd                 ',
                    '━[F[ folder ]]                                 ',
                    '  └─ aaa                                       ',
                    '     └─ bbb                                    ',
                    '        └─ ccc                                 ',
                    '           ├─ ▶ task-in-ccc                    ',
                    '           └─ ddd                              ',
                    '              └─ ▶ task-in-ddd                 '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
