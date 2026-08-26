import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Configuration from '../../../src/Configuration';


// В settings.json:
// "booleanConfig": {
//     "trueKey": true,
//     "falseKey": false,
//     "oneKey": 1,
//     "zeroKey": 0,
//     "trueStringKey": "true",
//     "emptyStringKey": ""
// }

suite('Configuration', function () {


    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });


    suite('coerce', function () {

        suite('coerceBoolean (валидация булевых значений)', function () {

            // const baseSection = 'booleanConfig';
            // const configurationScope = null;

            suiteSetup(function () {
                const workspaceConfiguration = vscode.workspace.getConfiguration();

                assert.ok(!workspaceConfiguration.get('booleanConfig.noExistKey'),
                    'pre: booleanConfig.noExistKey не должно быть в конфигурации');

                assert.equal(workspaceConfiguration.get('booleanConfig.trueKey'), true,
                    'pre: booleanConfig.trueKey должен присутствовать и быть true');

                assert.equal(workspaceConfiguration.get('booleanConfig.falseKey'), false,
                    'pre: booleanConfig.falseKey должен присутствовать и быть false');

                assert.equal(workspaceConfiguration.get('booleanConfig.oneKey'), 1,
                    'pre: booleanConfig.oneKey должен присутствовать и быть числом 1');

                assert.equal(workspaceConfiguration.get('booleanConfig.zeroKey'), 0,
                    'pre: booleanConfig.zeroKey должен присутствовать и быть числом 0');

                assert.equal(workspaceConfiguration.get('booleanConfig.trueStringKey'), 'true',
                    'pre: booleanConfig.trueStringKey должен присутствовать и быть строкой "true"');

                assert.equal(workspaceConfiguration.get('booleanConfig.emptyStringKey'), '',
                    'pre: booleanConfig.emptyStringKey должен присутствовать и быть пустой строкой');
            });


            test(`${/*++N*/'001'/**/} отсутствующий ключ — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ noExistKey: boolean; }>({
                    noExistKey: Configuration.BooleanSpec({
                        configKey: 'booleanConfig.noExistKey',
                        fallback: true
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.noExistKey, true,
                    'noExistKey: должен вернуть фолбек значение');

            });

            test(`${/*++N*/'002'/**/} значение true — возвращает true`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ trueKey: boolean; }>({
                    trueKey: Configuration.BooleanSpec({
                        configKey: 'booleanConfig.trueKey',
                        fallback: false
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.trueKey, true,
                    'trueKey: должен вернуть true из конфигурации');

            });

            test(`${/*++N*/'003'/**/} значение false — возвращает false, не фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration();

                // Ловушка: наивная проверка !rawValue вернёт фолбек вместо false
                const schema = Configuration.createSchema<{ falseKey: boolean; }>({
                    falseKey: Configuration.BooleanSpec({
                        configKey: 'booleanConfig.falseKey',
                        fallback: true
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.falseKey, false,
                    'falseKey: false — валидное булево значение, фолбек не должен применяться');

            });

            test(`${/*++N*/'004'/**/} значение 1 (truthy число) — возвращает фолбек, не true`, function () {

                const configObj = vscode.workspace.getConfiguration();

                // Ловушка: !!rawValue === true, но 1 — не boolean
                const schema = Configuration.createSchema<{ oneKey: boolean; }>({
                    oneKey: Configuration.BooleanSpec({
                        configKey: 'booleanConfig.oneKey',
                        fallback: false
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.oneKey, false,
                    'oneKey: 1 не является boolean, должен вернуть фолбек');

            });

            test(`${/*++N*/'005'/**/} значение 0 (falsy число) — возвращает фолбек, не false`, function () {

                const configObj = vscode.workspace.getConfiguration();

                // Ловушка: выглядит как false, но typeof 0 !== 'boolean'
                const schema = Configuration.createSchema<{ zeroKey: boolean; }>({
                    zeroKey: Configuration.BooleanSpec({
                        configKey: 'booleanConfig.zeroKey',
                        fallback: true
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.zeroKey, true,
                    'zeroKey: 0 не является boolean, должен вернуть фолбек');

            });

            test(`${/*++N*/'006'/**/} значение "true" (truthy строка) — возвращает фолбек, не true`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ trueStringKey: boolean; }>({
                    trueStringKey: Configuration.BooleanSpec({
                        configKey: 'booleanConfig.trueStringKey',
                        fallback: false
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.trueStringKey, false,
                    'trueStringKey: строка "true" не является boolean, должен вернуть фолбек');

            });

            test(`${/*++N*/'007'/**/} значение "" (falsy строка) — возвращает фолбек, не false`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ emptyStringKey: boolean; }>({
                    emptyStringKey: Configuration.BooleanSpec({
                        configKey: 'booleanConfig.emptyStringKey',
                        fallback: true
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.emptyStringKey, true,
                    'emptyStringKey: пустая строка не является boolean, должен вернуть фолбек');

            });

        });
    });

});
