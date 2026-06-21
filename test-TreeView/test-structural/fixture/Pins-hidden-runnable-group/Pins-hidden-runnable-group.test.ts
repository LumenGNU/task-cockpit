import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Tree scenarios', function () {

    suite('Pins', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('закрепленная скрытая runnable-группа, имеет потомка. В дереве просто группа. В Pins игнорирует `showHidden = false` — задача', async function () {
            // задача, которая одновременно является группой и скрыта (hidden=true)
            // — закреплена.
            // Ожидается: в Pins-секции узел рендерится как чистая задача без потомка.
            // Задействованные настройки: segmentSeparator=":" (иерархия по сегментам),
            //                            showHidden=false (скрытые задачи не показываются).

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[★[ Pins ]]                        ',
                    '  └─ AAA › BBB                        ',
                    '     └─ ▶ Task & Group               ', // если закреплена → отображается как задача
                    // Sub Task не закреплена → ее нет, артефактов нет
                    '━[F[ Pins-hidden-runnable-group ]]   ',
                    '  └─ AAA                             ',
                    '     └─ BBB                          ',
                    '        └─ Task & Group              ', // здесь просто группа — задача скрыта
                    '           └─ ▶ Sub Task             '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
