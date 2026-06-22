import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios', function () {

    suite('Hierarchy', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('задача-группа: узел одновременно runnable и содержит дочерние задачи', async function () {
            // Задача-группа: узел одновременно runnable и содержит дочерние задачи.
            // Проверяет: корректное отображение задачи с данными, у которой есть потомки.
            // "build" имеет и собственные данные, и дочерние узлы.
            // "test" — чистая группа (implicit intermediate node).
            //
            // Задействованные настройки: segmentSeparator=":" (иерархия по сегментам).

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ task-as-group ]]            ',
                    '  ├─ test              ',
                    '  │  ├─ ▶ test-task-1  ',
                    '  │  ├─ ▶ test-task-2  ',
                    '  │  └─ ▶ test-task-3  ',
                    '  ├─ ▶ build-all       ', // и задача, и группа
                    '  │  ├─ ▶ build-task-1 ',
                    '  │  ├─ ▶ build-task-2 ',
                    '  │  └─ ▶ build-task-3 ',
                    '  └─ ▶ task            '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
