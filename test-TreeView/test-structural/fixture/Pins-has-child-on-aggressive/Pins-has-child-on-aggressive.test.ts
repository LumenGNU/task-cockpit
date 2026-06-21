import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Tree scenarios', function () {

    suite('Pins', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('pathCompression="on-aggressive" — узел с детьми в pinned-дереве не должен сжиматься', async function () {
            // SMART compression — узел с детьми в pinned-дереве не должен сжиматься.
            //
            // app1, app3: build-all + build-all:prepare закреплены →
            //   build-all имеет ребёнка в pinned-дереве → не сжимается → RunnableGroup.
            // app2: только build-all:prepare закреплён →
            //   build-all промежуточный, детей нет → сжимается в build-all › prepare.
            // app3: порядок refs отличается от app1, результат должен быть тем же.
            //
            // Задействованные настройки: segmentSeparator=":", compressionBehavior="SMART".

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[★[ Pins ]]                        ',
                    '  ├─ Pins-has-child-on-aggressive (Workspace)      ',
                    '  │  └─ ▶ build-all                  ', // имеет ребёнка → не сжимается
                    '  │     └─ ▶ prepare                 ',
                    '  └─ folder                          ',
                    '     └─ ▶ build-all › prepare         ', // промежуточный без детей → сжимается
                    '━[F[ Pins-has-child-on-aggressive (Workspace) ]]   ',
                    '  └─ ▶ build-all                     ', // закреплена
                    '     └─ ▶ prepare                    ', // закреплена
                    '━[F[ folder ]]                       ',
                    '  └─ ▶ build-all                     ', // НЕ закреплена
                    '     └─ ▶ prepare                    '  // закреплена
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
