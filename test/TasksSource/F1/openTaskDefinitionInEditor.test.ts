import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type IFixture from '../extension';
import openTaskDefinitionInEditor from '../../../src/TasksSource/openTaskDefinitionInEditor';
import findTaskDefinitionRange from '../../../src/TasksSource/findTaskDefinitionRange';
import type TaskName from '../../../src/TaskName';

const TASKS_JSON = 'tasks.json';
const JSON_PATH = ['tasks'] as const;

// `${/*N=0*/'000'/**/}`

suite('openTaskDefinitionInEditor', function () {

    let fixture: IFixture;
    let tasksUri: vscode.Uri;

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        fixture = await ext.activate();
        assert.ok(fixture);
        tasksUri = fixture.getFileUri(TASKS_JSON);
    });

    setup(async function () {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    suite('Найдено', function () {

        test(`${/*++N*/'001'/**/} Уникальный label: selection указывает на узел задачи`, async function () {
            const taskName = 'unique' as TaskName;

            await openTaskDefinitionInEditor({ uri: tasksUri, JSONPath: JSON_PATH }, taskName);

            const editor = vscode.window.activeTextEditor;
            assert.ok(editor);

            const expected = findTaskDefinitionRange(editor.document.getText(), JSON_PATH, taskName);
            assert.ok(expected);

            assert.equal(editor.document.offsetAt(editor.selection.anchor), expected.end);
            assert.equal(editor.document.offsetAt(editor.selection.active), expected.start);
        });

        test(`${/*++N*/'002'/**/} Дубликат label: selection указывает на последнее вхождение`, async function () {
            const taskName = 'duplicate' as TaskName;

            await openTaskDefinitionInEditor({ uri: tasksUri, JSONPath: JSON_PATH }, taskName);

            const editor = vscode.window.activeTextEditor;
            assert.ok(editor);

            const expected = findTaskDefinitionRange(editor.document.getText(), JSON_PATH, taskName);
            assert.ok(expected);

            assert.equal(editor.document.offsetAt(editor.selection.anchor), expected.end);
            assert.equal(editor.document.offsetAt(editor.selection.active), expected.start);
        });

    });

    suite('Не найдено', function () {

        test(`${/*++N*/'003'/**/} Несуществующий label: throws, сообщение содержит label`, async function () {
            const taskName = 'nonexistent' as TaskName;

            await assert.rejects(
                () => openTaskDefinitionInEditor({ uri: tasksUri, JSONPath: JSON_PATH }, taskName),
                (err: Error) => {
                    assert.ok(err.message.includes(taskName));
                    assert.ok(!err.message.includes('unsaved'));
                    return true;
                }
            );
        });

        test(`${/*++N*/'004'/**/} Несуществующий label + dirty: throws с 'unsaved changes'`, async function () {
            const taskName = 'nonexistent' as TaskName;

            const doc = await vscode.workspace.openTextDocument(tasksUri);
            const editor = await vscode.window.showTextDocument(doc);
            await editor.edit(eb => eb.insert(new vscode.Position(0, 0), ' '));
            assert.ok(editor.document.isDirty);

            await assert.rejects(
                () => openTaskDefinitionInEditor({ uri: tasksUri, JSONPath: JSON_PATH }, taskName),
                (err: Error) => {
                    assert.ok(err.message.includes('unsaved changes'));
                    return true;
                }
            );

        });

    });

});
