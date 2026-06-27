import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import {
    createSchema,
    OptionType,
    read
} from 'src/Configuration/ConfigSchema';


// В каждом settings:
// "existsConfig": {
//     "existPath": {
//         "existKey": "value-from-***"
//     },
// }


// `${/*N=0*/'000'/**/}`

suite('ConfigSchema', function () {

    suite('scoped isolation', function () {

        const baseSection = 'existsConfig';
        const schema = createSchema({
            existKey: { section: 'existPath', type: OptionType.String, spec: { fallback: 'fail-str' } }
        });


        suiteSetup(function () {
            assert.ok(vscode.workspace.workspaceFile);

            const wsConfig = vscode.workspace.getConfiguration(baseSection, vscode.workspace.workspaceFile);
            assert.equal(wsConfig.get('existPath.existKey'), 'value-from-workspace',
                'pre: existPath.existKey должно быть в workspace конфигурации');

            const f1 = vscode.workspace.workspaceFolders?.[0];
            assert.ok(f1);
            const f1Config = vscode.workspace.getConfiguration(baseSection, f1);
            assert.equal(f1Config.get('existPath.existKey'), 'value-from-folder1',
                'pre: existPath.existKey должно быть в folder1 конфигурации');

            const f2 = vscode.workspace.workspaceFolders?.[1];
            assert.ok(f2);
            const f2Config = vscode.workspace.getConfiguration(baseSection, f2);
            assert.equal(f2Config.get('existPath.existKey'), 'value-from-folder2',
                'pre: existPath.existKey должно быть в folder2 конфигурации');
        });


        test(`${/*++N*/'001'/**/} возвращает значение из code-workspace::settings`, function () {

            const result = read({ baseSection, schema, configurationScope: vscode.workspace.workspaceFile });

            assert.ok(result);
            assert.equal(result.existKey, 'value-from-workspace');
        });


        test(`${/*++N*/'002'/**/} возвращает значение из folder1::settings`, function () {

            const result = read({ baseSection, schema, configurationScope: vscode.workspace.workspaceFolders?.[0] });

            assert.ok(result);
            assert.equal(result.existKey, 'value-from-folder1');

        });


        test(`${/*++N*/'003'/**/} возвращает значение из folder2::settings`, function () {

            const result = read({ baseSection, schema, configurationScope: vscode.workspace.workspaceFolders?.[1] });

            assert.ok(result);
            assert.equal(result.existKey, 'value-from-folder2');

        });


    });

});
