import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import Configuration from '../../../src/Configuration';
import { OptionType } from '../../../src/Configuration';

// В settings.json:
// "stringConfig": {
//     "stringKey": "string-value",
//     "noStringKey": 42,
//     "ipAddress": "196.167.0.100",
//     "noIpAddress": "196.167.O.100"
// }

interface StringConfigSchemaI {
    noExistKey?: string;
    stringKey?: string;
    noStringKey?: string;
    ipAddress?: string;
    noIpAddress?: string;
}

// `${/*N=0*/'000'/**/}`

suite('Configuration', function () {

    suite('get', function () {

        suite('coerceString (валидация строк)', function () {

            let workspaceConfiguration: vscode.WorkspaceConfiguration;

            suiteSetup(function () {
                workspaceConfiguration = vscode.workspace.getConfiguration('stringConfig');

                assert.ok(!workspaceConfiguration.get('noExistKey'),
                    'pre: stringConfig.noExistKey не должно быть в конфигурации');

                assert.equal(typeof workspaceConfiguration.get('stringKey'), 'string',
                    'pre: stringConfig.stringKey должен присутствовать и быть строкой');

                assert.equal(workspaceConfiguration.get('stringKey'), 'string-value',
                    'pre: stringConfig.stringKey должен присутствовать и иметь значение "string-value"');

                assert.equal(typeof workspaceConfiguration.get('noStringKey'), 'number',
                    'pre: stringConfig.noStringKey должен присутствовать и быть числом');

                assert.equal(workspaceConfiguration.get('ipAddress'), '196.167.0.100',
                    'pre: stringConfig.ipAddress должен присутствовать и быть валидным IP)');

                assert.equal(workspaceConfiguration.get('noIpAddress'), '196.167.O.100',
                    'pre: stringConfig.noIpAddress должен присутствовать и не быть валидным IP (O вместо 0)');

            });


            test(`${/*++N*/'001'/**/} отсутствующий ключ — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<StringConfigSchemaI>({
                    noExistKey: { from: '.', type: OptionType.String, spec: { fallback: 'default-string' } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.noExistKey, 'default-string',
                    'noExistKey: должен вернуть фолбек значение');

            });

            test(`${/*++N*/'002'/**/} значение является строкой, проверки нет — возвращает как есть`, function () {

                const schema = Configuration.createSchema<StringConfigSchemaI>({
                    stringKey: { from: '.', type: OptionType.String, spec: { fallback: 'default-string' } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.stringKey, 'string-value',
                    'stringKey: должен вернуть значение из конфигурации');

            });

            test(`${/*++N*/'003'/**/} значение не является строкой, проверки нет — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<StringConfigSchemaI>({
                    noStringKey: { from: '.', type: OptionType.String, spec: { fallback: 'default-for-no-string' } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.noStringKey, 'default-for-no-string',
                    'noStringKey: должен вернуть фолбек значение');

            });


            test(`${/*++N*/'004'/**/} значение не является строкой, проверка есть — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<StringConfigSchemaI>({
                    noStringKey: { from: '.', type: OptionType.String, spec: { fallback: 'default-for-no-string', pattern: /.*/ } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.noStringKey, 'default-for-no-string',
                    'noStringKey: должен вернуть фолбек значение');

            });


            test(`${/*++N*/'005'/**/} строка проходит pattern — возвращает как есть`, function () {

                const schema = Configuration.createSchema<StringConfigSchemaI>({
                    ipAddress: { from: '.', type: OptionType.String, spec: { fallback: '127.0.0.0', pattern: /^((1?[\d]?[\d]|2([0-4][\d]|5[0-5]))[.]){3}(1?[\d]?[\d]|2([0-4][\d]|5[0-5]))$/ } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.ipAddress, '196.167.0.100',
                    'ipAddress: должен вернуть значение из конфигурации');

            });

            test(`${/*++N*/'006'/**/} строка не проходит pattern — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<StringConfigSchemaI>({
                    noIpAddress: { from: '.', type: OptionType.String, spec: { fallback: '127.0.0.0', pattern: /^((1?[\d]?[\d]|2([0-4][\d]|5[0-5]))[.]){3}(1?[\d]?[\d]|2([0-4][\d]|5[0-5]))$/ } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.noIpAddress, '127.0.0.0',
                    'noIpAddress: не прошёл pattern, должен вернуть фолбек');

            });


        });
    });

});
