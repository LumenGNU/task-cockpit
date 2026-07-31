import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Configuration from 'src/Configuration';


// В settings.json:
// "stringConfig": {
//     "stringKey": "string-value",
//     "noStringKey": 42,
//     "ipAddress": "196.167.0.100",
//     "noIpAddress": "196.167.O.100"
// }

// `${/*N=0*/'000'/**/}`

suite('Configuration', function () {


    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });


    suite('coerce', function () {

        suite('coerceString (валидация строк)', function () {

            // const baseSection = 'stringConfig';
            // const configurationScope = null;

            suiteSetup(function () {
                const workspaceConfiguration = vscode.workspace.getConfiguration();

                assert.ok(!workspaceConfiguration.get('stringConfig.noExistKey'),
                    'pre: stringConfig.noExistKey не должно быть в конфигурации');

                assert.equal(typeof workspaceConfiguration.get('stringConfig.stringKey'), 'string',
                    'pre: stringConfig.stringKey должен присутствовать и быть строкой');

                assert.equal(workspaceConfiguration.get('stringConfig.stringKey'), 'string-value',
                    'pre: stringConfig.stringKey должен присутствовать и иметь значение "string-value"');

                assert.equal(typeof workspaceConfiguration.get('stringConfig.noStringKey'), 'number',
                    'pre: stringConfig.noStringKey должен присутствовать и быть числом');

                assert.equal(workspaceConfiguration.get('stringConfig.ipAddress'), '196.167.0.100',
                    'pre: stringConfig.ipAddress должен присутствовать и быть валидным IP)');

                assert.equal(workspaceConfiguration.get('stringConfig.noIpAddress'), '196.167.O.100',
                    'pre: stringConfig.noIpAddress должен присутствовать и не быть валидным IP (O вместо 0)');

            });


            test(`${/*++N*/'001'/**/} отсутствующий ключ — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ noExistKey: string; }>({
                    noExistKey: Configuration.StringSpec({
                        configKey: 'stringConfig.noExistKey',
                        fallback: 'default-string'
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.noExistKey, 'default-string',
                    `noExistKey: должен вернуть фолбек значение, но ${result.noExistKey} != default-string`);

            });

            test(`${/*++N*/'002'/**/} значение является строкой, проверки нет — возвращает как есть`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ stringKey: string; }>({
                    stringKey: Configuration.StringSpec({
                        configKey: 'stringConfig.stringKey',
                        fallback: 'default-string'
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.stringKey, 'string-value',
                    'stringKey: должен вернуть значение из конфигурации');

            });

            test(`${/*++N*/'003'/**/} значение не является строкой, проверки нет — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ noStringKey: string; }>({
                    noStringKey: Configuration.StringSpec({
                        configKey: 'stringConfig.noStringKey',
                        fallback: 'default-for-no-string'
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.noStringKey, 'default-for-no-string',
                    'noStringKey: должен вернуть фолбек значение');

            });


            test(`${/*++N*/'004'/**/} значение не является строкой, проверка есть — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ noStringKey: string; }>({
                    noStringKey: Configuration.StringSpec({
                        configKey: 'stringConfig.noStringKey',
                        fallback: 'default-for-no-string',
                        pattern: /.*/
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.noStringKey, 'default-for-no-string',
                    'noStringKey: должен вернуть фолбек значение');

            });


            test(`${/*++N*/'005'/**/} строка проходит pattern — возвращает как есть`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ ipAddress: string; }>({
                    ipAddress: Configuration.StringSpec({
                        configKey: 'stringConfig.ipAddress',
                        fallback: '127.0.0.0',
                        pattern: /^((1?[\d]?[\d]|2([0-4][\d]|5[0-5]))[.]){3}(1?[\d]?[\d]|2([0-4][\d]|5[0-5]))$/
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.ipAddress, '196.167.0.100',
                    'ipAddress: должен вернуть значение из конфигурации');

            });

            test(`${/*++N*/'006'/**/} строка не проходит pattern — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ noIpAddress: string; }>({
                    noIpAddress: Configuration.StringSpec({
                        configKey: 'stringConfig.noIpAddress',
                        fallback: '127.0.0.0',
                        pattern: /^((1?[\d]?[\d]|2([0-4][\d]|5[0-5]))[.]){3}(1?[\d]?[\d]|2([0-4][\d]|5[0-5]))$/
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.noIpAddress, '127.0.0.0',
                    'noIpAddress: не прошёл pattern, должен вернуть фолбек');

            });

        });
    });

});
