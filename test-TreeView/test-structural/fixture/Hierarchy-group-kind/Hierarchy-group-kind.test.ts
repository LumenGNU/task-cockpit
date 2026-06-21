import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios', function () {

    suite('Hierarchy', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('группировка по свойству group', async function () {
            // Группировка по свойству group (useGroupKind=true, segmentSeparator отключён).
            // Проверяет: создание group-папок, имени группы,
            // задачи без group остаются на верхнем уровне,
            // порядок не ломается.

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ Hierarchy-group-kind ]] ',
                    '  ├─ ▶ task-1                    ',
                    '  ├─ Build                       ',
                    '  │  ├─ ▶ task-in-Build-group-1  ',
                    '  │  └─ ▶ task-in-Build-group-2  ',
                    '  ├─ Test                        ',
                    '  │  ├─ ▶ task-in-Test-group-1   ',
                    '  │  └─ ▶ task-in-Test-group-2   ',
                    '  └─ ▶ task-2                    '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
