import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import { createSchema, SpecType, coerce } from 'src/StateCoordinator/ConfigSchema/ConfigSchema';

// В settings.json:
// "stringConfig": {
//     "stringKey": "string-value",
//     "noStringKey": 42,
//     "ipAddress": "196.167.0.100",
//     "noIpAddress": "196.167.O.100"
// }

// `${/*N=0*/'000'/**/}`

suite('ConfigSchema', function () {


    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });


    suite('coerce', function () {

        suite('coerceString (валидация строк)', function () {

            const baseSection = 'stringConfig';
            const configurationScope = null;

            suiteSetup(function () {
                const workspaceConfiguration = vscode.workspace.getConfiguration(baseSection);

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

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ noExistKey: string; }>({
                    noExistKey: { section: '', type: SpecType.String, spec: { fallback: 'default-string' } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.noExistKey, 'default-string',
                    `noExistKey: должен вернуть фолбек значение, но ${result.noExistKey} != default-string`);

            });

            test(`${/*++N*/'002'/**/} значение является строкой, проверки нет — возвращает как есть`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ stringKey: string; }>({
                    stringKey: { section: '', type: SpecType.String, spec: { fallback: 'default-string' } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.stringKey, 'string-value',
                    'stringKey: должен вернуть значение из конфигурации');

            });

            test(`${/*++N*/'003'/**/} значение не является строкой, проверки нет — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ noStringKey: string; }>({
                    noStringKey: { section: '', type: SpecType.String, spec: { fallback: 'default-for-no-string' } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.noStringKey, 'default-for-no-string',
                    'noStringKey: должен вернуть фолбек значение');

            });


            test(`${/*++N*/'004'/**/} значение не является строкой, проверка есть — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ noStringKey: string; }>({
                    noStringKey: { section: '', type: SpecType.String, spec: { fallback: 'default-for-no-string', pattern: /.*/ } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.noStringKey, 'default-for-no-string',
                    'noStringKey: должен вернуть фолбек значение');

            });


            test(`${/*++N*/'005'/**/} строка проходит pattern — возвращает как есть`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ ipAddress: string; }>({
                    ipAddress: { section: '', type: SpecType.String, spec: { fallback: '127.0.0.0', pattern: /^((1?[\d]?[\d]|2([0-4][\d]|5[0-5]))[.]){3}(1?[\d]?[\d]|2([0-4][\d]|5[0-5]))$/ } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.ipAddress, '196.167.0.100',
                    'ipAddress: должен вернуть значение из конфигурации');

            });

            test(`${/*++N*/'006'/**/} строка не проходит pattern — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ noIpAddress: string; }>({
                    noIpAddress: { section: '', type: SpecType.String, spec: { fallback: '127.0.0.0', pattern: /^((1?[\d]?[\d]|2([0-4][\d]|5[0-5]))[.]){3}(1?[\d]?[\d]|2([0-4][\d]|5[0-5]))$/ } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.noIpAddress, '127.0.0.0',
                    'noIpAddress: не прошёл pattern, должен вернуть фолбек');

            });

        });
    });

});
