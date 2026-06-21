import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Tree scenarios', function () {

    suite('Pins', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('пины для дерева с неадекватно глубокой вложенностью', async function () {
            // Pinned SMART compression на неадекватно глубокой вложенности.
            // Все 5 задач закреплены. Цепочки длиной 6–9 сегментов.
            // Проверяет: SMART корректно сжимает длинные линейные цепочки,
            // не сжимает узлы с несколькими детьми в pinned-дереве.
            //
            // Задействованные настройки: segmentSeparator=':', compressionBehavior='SMART'.

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[★[ Pins ]]                                                                                     ',
                    '  ├─ a › b › c › d › e                                                                                  ',
                    '  │  ├─ f › g › h › k › l › m › n › o › p › r › s › t › x › y › z                                                    ',
                    '  │  │  ├─ ▶ task-2                                                                                ',
                    '  │  │  └─ ▶ task-3                                                                                ',
                    '  │  └─ ▶ g › h › task-4                                                                              ',
                    '  ├─ ▶ S › a › b › c › d › e › f › g › h › k › l › m › n › o › p › r › s › t › x › y › z › task-1                              ',
                    '  └─ ▶ x › y › z › task-5                                                                              ',
                    '━[F[ Pins-deep-nesting ]]                                                                                      ',
                    '  ├─ a                                                                                             ',
                    '  │  └─ b                                                                                          ',
                    '  │     └─ c                                                                                       ',
                    '  │        └─ d                                                                                    ',
                    '  │           └─ e                                                                                 ',
                    '  │              ├─ f                                                                              ',
                    '  │              │  └─ g                                                                           ',
                    '  │              │     └─ h                                                                        ',
                    '  │              │        └─ k                                                                     ',
                    '  │              │           └─ l                                                                  ',
                    '  │              │              └─ m                                                               ',
                    '  │              │                 └─ n                                                            ',
                    '  │              │                    └─ o                                                         ',
                    '  │              │                       └─ p                                                      ',
                    '  │              │                          └─ r                                                   ',
                    '  │              │                             └─ s                                                ',
                    '  │              │                                └─ t                                             ',
                    '  │              │                                   └─ x                                          ',
                    '  │              │                                      └─ y                                       ',
                    '  │              │                                         └─ z                                    ',
                    '  │              │                                            ├─ ▶ task-2                          ',
                    '  │              │                                            └─ ▶ task-3                          ',
                    '  │              └─ g                                                                              ',
                    '  │                 └─ h                                                                           ',
                    '  │                    └─ ▶ task-4                                                                 ',
                    '  ├─ S                                                                                             ',
                    '  │  └─ a                                                                                          ',
                    '  │     └─ b                                                                                       ',
                    '  │        └─ c                                                                                    ',
                    '  │           └─ d                                                                                 ',
                    '  │              └─ e                                                                              ',
                    '  │                 └─ f                                                                           ',
                    '  │                    └─ g                                                                        ',
                    '  │                       └─ h                                                                     ',
                    '  │                          └─ k                                                                  ',
                    '  │                             └─ l                                                               ',
                    '  │                                └─ m                                                            ',
                    '  │                                   └─ n                                                         ',
                    '  │                                      └─ o                                                      ',
                    '  │                                         └─ p                                                   ',
                    '  │                                            └─ r                                                ',
                    '  │                                               └─ s                                             ',
                    '  │                                                  └─ t                                          ',
                    '  │                                                     └─ x                                       ',
                    '  │                                                        └─ y                                    ',
                    '  │                                                           └─ z                                 ',
                    '  │                                                              └─ ▶ task-1                       ',
                    '  └─ x                                                                                             ',
                    '     └─ y                                                                                          ',
                    '        └─ z                                                                                       ',
                    '           └─ ▶ task-5                                                                             '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
