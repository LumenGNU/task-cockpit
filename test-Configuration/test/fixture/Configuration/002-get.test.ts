import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import { Configuration, OptionType } from 'src/Configuration/Configuration';


// В settings.json:
// "existsConfig": {
//     "existPath": {
//         "existKey": "str-from-config (existKey)"
//     },
//     "rootKey": "str-from-config (rootKey)"
// }


// `${/*N=0*/'000'/**/}`

suite('Configuration', function () {

    suite('get', function () {

        let workspaceConfiguration: vscode.WorkspaceConfiguration;

        suiteSetup(function () {

            workspaceConfiguration = vscode.workspace.getConfiguration('existsConfig');

            assert.equal(typeof workspaceConfiguration.get('existPath.existKey'), 'string',
                'pre: existsConfig.existPath.existKey должен присутствовать и быть строкой');
            assert.equal(typeof workspaceConfiguration.get('rootKey'), 'string',
                'pre: existsConfig.rootKey должен присутствовать и быть строкой');
            assert.ok(!workspaceConfiguration.get('noExistKey'),
                'pre: existsConfig.noExistKey не должно быть в конфигурации');

        });

        test(`${/*++N*/'001'/**/} возвращает plain object без прототипа`, function () {

            const result = Configuration.get({}, workspaceConfiguration);

            assert.ok(result);
            assert.equal(Reflect.getPrototypeOf(result), null);
        });


        test(`${/*++N*/'002'/**/} присутствующая конфигурация возвращает значения по указанному пути`, function () {

            const result = Configuration.get({
                existKey: { from: 'existPath', type: OptionType.String, spec: { fallback: 'def-str' } }
            }, workspaceConfiguration);

            assert.ok(result, 'должен вернуть результат');
            assert.ok('existKey' in result, 'поле existKey должно присутствовать в результате');
            assert.equal(result.existKey, 'str-from-config (existKey)', 'поле existKey должно иметь значение из конфигурации');

        });


        test(`${/*++N*/'003'/**/} специально значение path="." — поле читается из "корня"`, function () {

            const result = Configuration.get({
                rootKey: { from: '.', type: OptionType.String, spec: { fallback: 'def-str' } }
            }, workspaceConfiguration);

            assert.equal(result.rootKey, 'str-from-config (rootKey)', 'поле rootKey должно иметь значение из конфигурации');

        });

        test(`${/*++N*/'004'/**/} чтение не существующего ключа — фолбек`, function () {

            const result = Configuration.get({
                noExistKey: { from: '.', type: OptionType.String, spec: { fallback: 'default-str' } }
            }, workspaceConfiguration);

            assert.equal(result.noExistKey, 'default-str', 'поле noExistKey должно иметь значение по умолчанию');

        });

    });

});
