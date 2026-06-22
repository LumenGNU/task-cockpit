import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios', function () {

    suite('Hierarchy', function () {

        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('позиция ветки определяется первым упоминанием в файле, а не позицией корневой задачи', async function () {
            // Позиция ветки определяется первым упоминанием в файле, а не позицией корневой задачи.
            // AAA, BBB, CCC — задачи-группы; их корневые узлы определены после дочерних.
            //
            // Порядок появления в файле:
            //   AAA:child-task-1 → ветка AAA закрепляется 1-й
            //   BBB:child-task-1 → ветка BBB закрепляется 2-й
            //   CCC:child-task-1 → ветка CCC закрепляется 3-й
            //   ...дочерние продолжают заполнять ветки...
            //   BBB  // корневая задача — 3-я по порядку в файле
            //   CCC  // корневая задача — 4-я
            //   AAA  // корневая задача — 5-я
            //
            // Ожидаемый порядок верхнего уровня: AAA, BBB, CCC — по первому упоминанию.
            //
            // Задействованные настройки: segmentSeparator=":".

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    "━[F[ branch-position ]]              ",
                    "  ├─ ▶ AAA               ", // ветка 1-я: по child-task-1, хотя AAA — последний в файле
                    "  │  ├─ ▶ child-task-1   ",
                    "  │  └─ ▶ child-task-2   ",
                    "  ├─ ▶ BBB               ", // ветка 2-я
                    "  │  ├─ ▶ child-task-1   ",
                    "  │  ├─ ▶ child-task-2   ",
                    "  │  └─ ▶ child-task-3   ",
                    "  └─ ▶ CCC               ", // ветка 3-я
                    "     ├─ ▶ child-task-1   ",
                    "     └─ ▶ child-task-2   "
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
