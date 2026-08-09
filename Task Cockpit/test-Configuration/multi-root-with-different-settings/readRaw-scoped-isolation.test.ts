import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Configuration from '../../src/Configuration';


// `${/*N=0*/'000'/**/}`

suite('Configuration', function () {

    suite('readRaw scoped изоляция', function () {

        suiteSetup(async function () {
            const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
            assert.ok(ext);
            await ext.activate();

            // --- Контракт фикстуры ---
            assert.ok(vscode.workspace.workspaceFile);
            assert.equal(vscode.workspace.name, 'multi-root-with-different-settings (Workspace)');
            assert.ok(vscode.workspace.workspaceFolders?.length === 3, `ожидали каталогов в проекте 3, получено ${vscode.workspace.workspaceFolders?.length}`);

        });


        test(`${/*++N*/'001'/**/} Configuration scope = null, IsolationMode = GlobalOnly — возвращает значение из user-конфигурации`, function () {

            const configObj = vscode.workspace.getConfiguration('', null);
            const result = Configuration.readRaw(configObj, 'extConfig.key', Configuration.IsolationMode.GlobalOnly);

            assert.equal(result, 'value-from-global');
        });

        test(`${/*++N*/'002'/**/} Configuration scope = null, IsolationMode = WorkspaceOnly — возвращает значение из  workspace-конфигурации`, function () {
            const configObj = vscode.workspace.getConfiguration('', null);
            const result = Configuration.readRaw(configObj, 'extConfig.key', Configuration.IsolationMode.WorkspaceOnly);

            assert.equal(result, 'value-from-workspace');
        });

        test(`${/*++N*/'003'/**/} Configuration scope = folder1, IsolationMode = FolderOnly — возвращает значение из folder1-конфигурации`, function () {

            const folder = vscode.workspace.workspaceFolders?.[0];
            assert.ok(folder);
            assert.equal(folder.name, 'folder1');
            const configObj = vscode.workspace.getConfiguration('', folder);
            const result = Configuration.readRaw(configObj, 'extConfig.key', Configuration.IsolationMode.FolderOnly);

            assert.equal(result, 'value-from-folder1');
        });

        test(`${/*++N*/'004'/**/} Configuration scope = folder2, IsolationMode = FolderOnly — возвращает значение из folder2-конфигурации`, function () {

            const folder = vscode.workspace.workspaceFolders?.[1];
            assert.ok(folder);
            assert.equal(folder.name, 'folder2');
            const configObj = vscode.workspace.getConfiguration('', folder);
            const result = Configuration.readRaw(configObj, 'extConfig.key', Configuration.IsolationMode.FolderOnly);

            assert.equal(result, 'value-from-folder2');
        });

        test(`${/*++N*/'005'/**/} Configuration scope = truly-empty, IsolationMode = FolderOnly — возвращает undefined`, function () {

            const folder = vscode.workspace.workspaceFolders?.[2];
            assert.ok(folder);
            assert.equal(folder.name, 'truly-empty');
            const configObj = vscode.workspace.getConfiguration('', folder);
            const result = Configuration.readRaw(configObj, 'extConfig.key', Configuration.IsolationMode.FolderOnly);

            assert.equal(result, undefined);
        });

    });

});
