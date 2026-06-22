import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios', function () {

    suite('Hierarchy', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('комбинация segmentSeparator + useGroupKind', async function () {
            // Комбинация segmentSeparator + useGroupKind.
            // Проверяет взаимодействие двух механизмов иерархии одновременно.
            // README предупреждает о дублировании: задача с именем, начинающимся с того же
            // слова что и group.kind, при включённом separator создаёт двойную вложенность.
            //
            // Сценарий:
            // 1) group совпадает с prefix сегмента (Build:... + group Build) → дублирование
            // 2) group не совпадает с prefix сегмента (deploy:... + group Test) → норма
            // 3) нет group, только separator → только segment-иерархия
            //
            // Задействованные настройки: segmentSeparator=":", useGroupKind=true.

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ separator-group-kind-combined ]]           ',
                    '  ├─ Build                ', // group folder
                    '  │  └─ Build             ', // сегмент — дублирование!
                    '  │     ├─ ▶ child-task-1 ',
                    '  │     └─ ▶ child-task-2 ',
                    '  ├─ Test                 ', // group folder
                    '  │  └─ deploy            ', // сегмент — дублирования нет
                    '  │     ├─ ▶ child-task-1 ',
                    '  │     └─ ▶ child-task-2 ',
                    '  └─ AAA                  ', // только segment-иерархия
                    '     └─ ▶ child-task-1    '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
