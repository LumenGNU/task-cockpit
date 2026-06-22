import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';


suite('Pins', function () {

    suite('Tree Structure', function () {
        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();
        });

        test('Комплексный сценарий: скрытая задача-группа + pin на скрытую задачу', async function () {
            // Скрытая задача-группа + pinned-ссылка на скрытую задачу, compressionBehavior=SMART.
            // Комплексный сценарий:
            //
            // 1) "parent-task" — task-as-group, помечена hidden.
            //    Дети "parent-task:child-task-1" и "parent-task:child-task-2" видимы.
            //    В основном дереве "parent-task" становится implicit group (без данных задачи).
            //    В Pinned — ссылается на hidden-задачу → отображается как runnable.
            //
            // 2) "a:b:Task & Group" — скрыта, дочерний "a:b:Task & Group:Sub Task" виден.
            //    В основном дереве "Task & Group" — implicit group.
            //    В Pinned — SMART сжимает линейную цепочку a › b, "Task & Group" — runnable.
            //
            // Задействованные настройки: segmentSeparator=":", pins.pathCompression="on-aggressive".

            const result = await vscode.commands.executeCommand<string>(
                'taskCockpit.test.getTreeStructure'
            );

            assert.ok(result !== undefined, 'команда вернула undefined — расширение не активировано?');

            assert.strictEqual(result,
                [
                    '━[★[ Pins ]]              ',
                    '  ├─ ▶ parent-task          ', // hidden, но в pinned — runnable
                    '  └─ ▶ a › b › Task & Group    ', // линейная цепочка без детей → сжата. hidden, но в pinned — runnable
                    '━[F[ Pins-runnable-group-comprehensive-1 ]]                 ',
                    '  ├─ parent-task            ', // implicit group (задача скрыта, дети видимы)
                    '  │  ├─ ▶ child-task-1      ',
                    '  │  └─ ▶ child-task-2      ',
                    '  ├─ a                      ',
                    '  │  └─ b                   ',
                    '  │     └─ Task & Group     ', // implicit group (задача скрыта)
                    '  │        └─ ▶ Sub Task    ',
                    '  └─ ▶ standalone-task      '
                ].map(s => s.trimEnd()).join('\n')
            );

        });
    });
});
