import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios', function () {

    suite('Multi-root', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('multi-root workspace: несколько папок', async function () {
            // Multi-root workspace: несколько папок.
            // Проверяет:
            // - отображение заголовков папок (Workspace-узлы в multi-root)
            // - изоляцию задач по scope
            // - одноимённые ветки в разных scope не конфликтуют
            //
            // Задействованные настройки: segmentSeparator=':'.

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ Multi-root-basic (Workspace) ]]             ',
                    '  ├─ AAA                   ',
                    '  │  ├─ ▶ child-task-s1.1  ',
                    '  │  └─ ▶ child-task-s1.2  ',
                    '  └─ ▶ BBB                 ',
                    '━[F[ scope2 ]]             ',
                    '  ├─ AAA                   ',
                    '  │  ├─ ▶ child-task-s2.1  ',
                    '  │  └─ ▶ child-task-s2.2  ',
                    '  └─ ▶ BBB                 ',
                    '━[F[ scope3 ]]             ',
                    '  └─ ▶ CCC                 '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
