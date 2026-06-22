import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('Hierarchy', function () {

    suite('Multi-root', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('multi-root workspace: несколько папок', async function () {
            // Multi-root workspace: несколько папок.
            // Проверяет:
            // - изоляцию задач и настроек по scope
            // - одноимённые ветки в разных scope не конфликтуют
            //
            // Задействованные настройки:
            // workspace
            //   segmentSeparator=':'
            // folder1
            //   segmentSeparator='|'
            // folder2
            //   segmentSeparator='\'

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ multi-root (Workspace) ]]          ',
                    '  ├─ group(ws)                          ',
                    '  │  ├─ ▶ child-task-1(ws)              ',
                    '  │  └─ ▶ child-task-2(ws)              ',
                    '  └─ ▶ task-without-group(ws)           ',
                    '━[F[ folder1 ]]                         ',
                    '  ├─ group(f1)                          ',
                    '  │  ├─ ▶ child-task-1(f1)              ',
                    '  │  └─ ▶ child-task-2(f1)              ',
                    '  └─ ▶ task-without-group(f1)           ',
                    '━[F[ folder2 ]]                         ',
                    '  ├─ group(f2)                          ',
                    '  │  ├─ ▶ child-task-1(f2)              ',
                    '  │  └─ ▶ child-task-2(f2)              ',
                    '  └─ ▶ task-without-group(f2)           ',
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
