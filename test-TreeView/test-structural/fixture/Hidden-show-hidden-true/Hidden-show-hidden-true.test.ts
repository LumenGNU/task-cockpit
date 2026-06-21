import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';

suite('TreeView scenarios', function () {

    suite('Hidden', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('задачи отображаются при showHidden = true', async function () {

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.fillTree'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[F[ Hidden-show-hidden-true ]]         ',
                    '  ├─ AAA                   ',
                    '  │  ├─ ▶ visible          ',
                    '  │  └─ ▶ HIDDEN           ',
                    '  ├─ BBB                   ',
                    '  │  ├─ CCC                ',
                    '  │  │  └─ ▶ visible       ',
                    '  │  └─ b                  ',
                    '  │     └─ bb              ',
                    '  │        └─ bbb          ',
                    '  │           └─ ▶ HIDDEN  ',
                    '  ├─ ▶ HIDDEN-tool         ',
                    '  ├─ FFF                   ',
                    '  │  └─ ▶ segment&task     ',
                    '  │     └─ ▶ visible       ',
                    '  └─ HIDDEN                ',
                    '     └─ ▶ tool             '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
