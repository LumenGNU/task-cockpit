import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios', function () {

    suite('Edges', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('все скрыто', async function () {
            // Пограничные случаи: пустые состояния.
            // Проверяет:
            // 1) Папка "empty" — без задач. Отображается ли пустая папка?
            // 2) Папка "one-task" — единственная задача. Минимальный непустой случай.
            // 3) Папка "all-hidden" — все задачи скрыты при showHidden: false.
            //    По сути пустая, но технически задачи есть.

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    // пусто
                ].join('\n')
            );

        });
    });
});
