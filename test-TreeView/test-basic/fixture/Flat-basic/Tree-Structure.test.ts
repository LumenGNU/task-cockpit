import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios. Structural', function () {

    suite('Flat basic', function () {

        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('плоский список без иерархии', async function () {
            // Базовый случай: все задачи на одном уровне, separator отключён.
            // Проверяет: сохранение порядка из файла, рендеринг без вложенности.

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ Flat-basic ]]',
                    '  ├─ ▶ AAA',
                    '  ├─ ▶ BBB',
                    '  └─ ▶ CCC'
                ].join('\n')
            );

        });
    });
});
