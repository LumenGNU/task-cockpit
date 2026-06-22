import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Pins', function () {

    suite('Tree Structure', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('runnable, не закреплена но имеет закрепленного потомка. В дереве runnable-группа. В Pins просто группа', async function () {
            // задача, которая одновременно является группой
            // имеет закрепленного потомка, но сама не закреплена.
            // Задействованные настройки: segmentSeparator=":" (иерархия по сегментам),

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[★[ Pins ]]               ',
                    '  └─ AAA › BBB › Task & Group ', // тут просто группа
                    '     └─ ▶ Sub Task         ',
                    '━[F[ Pins-subtask-only ]]  ',
                    '  └─ AAA                   ',
                    '     └─ BBB                ',
                    '        └─ ▶ Task & Group  ', // и группа и задача, не закреплена
                    '           └─ ▶ Sub Task   '  // вложенная задача, закреплена
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
