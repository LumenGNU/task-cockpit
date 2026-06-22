import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios. Structural', function () {

    suite('Flat basic (numeric order)', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('плоский список без иерархии (цифры в именах)', async function () {
            // порядок из файла, если имена - цифры
            // Цифры НЕ всплывают и НЕ сортируются.
            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ Flat-basic-numeric-order ]]    ',
                    '  ├─ ▶ 100       ',
                    '  ├─ ▶ BBB       ',
                    '  ├─ ▶ AAA       ',
                    '  ├─ ▶ 3         ',
                    '  ├─ ▶ 1         ',
                    '  ├─ ▶ 0         ',
                    '  └─ ▶ 00        '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
