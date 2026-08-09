import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Configuration from '../../src/Configuration';


// В каждом settings:
// "extConfig": {
//     "key": "value-from-***"
// }
// truly-empty -- пустая, не имеет своей конфигурации

// `${/*N=0*/'000'/**/}`

suite('Configuration', function () {

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });

    suite('coerce scoped isolation', function () {

        const schema = Configuration.createSchema<{ testKey: string; }>({
            testKey: Configuration.StringSpec({ configKey: 'extConfig.key', fallback: 'fail-str' })
        });

        let folder1: vscode.WorkspaceFolder;
        let folder2: vscode.WorkspaceFolder;
        let folder3: vscode.WorkspaceFolder;

        suiteSetup(function () {
            assert.ok(vscode.workspace.workspaceFile);

            const wsConfig = vscode.workspace.getConfiguration('extConfig', vscode.workspace.workspaceFile);
            assert.equal(wsConfig.get('key'), 'value-from-workspace',
                'pre: extConfig.key должно быть в workspace конфигурации');

            folder1 = vscode.workspace.workspaceFolders?.[0]!;
            assert.ok(folder1);
            const f1Config = vscode.workspace.getConfiguration('extConfig', folder1);
            assert.equal(f1Config.get('key'), 'value-from-folder1',
                'pre: extConfig.key должно быть в folder1 конфигурации');

            folder2 = vscode.workspace.workspaceFolders?.[1]!;
            assert.ok(folder2);
            const f2Config = vscode.workspace.getConfiguration('extConfig', folder2);
            assert.equal(f2Config.get('key'), 'value-from-folder2',
                'pre: extConfig.key должно быть в folder2 конфигурации');

            folder3 = vscode.workspace.workspaceFolders?.[2]!;
            assert.ok(folder3);
            const f3Config = vscode.workspace.getConfiguration('extConfig', folder3);
            assert.equal(f3Config.get('key'), 'value-from-workspace',
                'pre: extConfig.key в folder3 должен мержится из workspace конфигурации');


        });


        test(`${/*++N*/'001'/**/} возвращает значение из конфигурации рабочей области, если scope не задан`, function () {

            const configObj = vscode.workspace.getConfiguration('', null);
            const result = Configuration.coerce(configObj, schema);

            assert.ok(result);
            assert.equal(result.testKey, 'value-from-workspace');
        });


        test(`${/*++N*/'002'/**/} возвращает значение из конфигурации folder1 при соответствующем scope`, function () {

            const configObj = vscode.workspace.getConfiguration('', folder1);

            const result = Configuration.coerce(configObj, schema);

            assert.ok(result);
            assert.equal(result.testKey, 'value-from-folder1');

        });


        test(`${/*++N*/'003'/**/} возвращает значение из конфигурации folder2 при соответствующем scope`, function () {

            const configObj = vscode.workspace.getConfiguration('', folder2);

            const result = Configuration.coerce(configObj, schema);

            assert.ok(result);
            assert.equal(result.testKey, 'value-from-folder2');

        });


        test(`${/*++N*/'004'/**/} folder2 — значение не меняется если включена изоляция`, function () {

            const configObj = vscode.workspace.getConfiguration('', folder2);

            const result = Configuration.coerce(configObj, schema, Configuration.IsolationMode.FolderOnly);

            assert.ok(result);
            assert.equal(result.testKey, 'value-from-folder2');

        });


        test(`${/*++N*/'005'/**/} у folder3 нет собственных настроек, изоляция выключена — возвращает значение, слитое из рабочей области`, function () {

            const configObj = vscode.workspace.getConfiguration('', folder3);

            const result = Configuration.coerce(configObj, schema);

            assert.ok(result);
            assert.equal(result.testKey, 'value-from-workspace');

        });

        test(`${/*++N*/'006'/**/} у folder3 нет собственных настроек, включена изоляция — возвращает значение по умолчанию из схемы`, function () {


            const configObj = vscode.workspace.getConfiguration('', folder3);

            const result = Configuration.coerce(configObj, schema, Configuration.IsolationMode.FolderOnly);

            assert.ok(result);
            assert.equal(result.testKey, 'fail-str');

        });


    });

});
