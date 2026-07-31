import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Configuration from 'src/Configuration';

// В settings.json:
// "numberConfig": {
//     "intKey": 42,
//     "noNumberKey": "forty-two",
//     "inRangeKey": 50,
//     "belowMinKey": -5,
//     "aboveMaxKey": 150,
//     "atMinKey": 10,
//     "atMaxKey": 100
// }


suite('Configuration', function () {


    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });


    suite('coerce', function () {

        suite('coerceNumber (валидация чисел)', function () {

            // const baseSection = 'numberConfig';
            // const configurationScope = null;

            suiteSetup(function () {
                const workspaceConfiguration = vscode.workspace.getConfiguration();

                assert.ok(!workspaceConfiguration.get('numberConfig.noExistKey'),
                    'pre: numberConfig.noExistKey не должно быть в конфигурации');

                assert.equal(typeof workspaceConfiguration.get('numberConfig.intKey'), 'number',
                    'pre: numberConfig.intKey должен присутствовать и быть числом');

                assert.equal(workspaceConfiguration.get('numberConfig.intKey'), 42,
                    'pre: numberConfig.intKey должен равняться 42');

                assert.equal(typeof workspaceConfiguration.get('numberConfig.noNumberKey'), 'string',
                    'pre: numberConfig.noNumberKey должен присутствовать и быть строкой');

                assert.equal(workspaceConfiguration.get('numberConfig.inRangeKey'), 50,
                    'pre: numberConfig.inRangeKey должен присутствовать и быть 50 (в диапазоне [0, 100])');

                assert.equal(workspaceConfiguration.get('numberConfig.belowMinKey'), -5,
                    'pre: numberConfig.belowMinKey должен присутствовать и быть -5 (ниже min=0)');

                assert.equal(workspaceConfiguration.get('numberConfig.aboveMaxKey'), 150,
                    'pre: numberConfig.aboveMaxKey должен присутствовать и быть 150 (выше max=100)');

                assert.equal(workspaceConfiguration.get('numberConfig.atMinKey'), 10,
                    'pre: numberConfig.atMinKey должен присутствовать и быть 0 (равен min)');

                assert.equal(workspaceConfiguration.get('numberConfig.atMaxKey'), 100,
                    'pre: numberConfig.atMaxKey должен присутствовать и быть 100 (равен max)');
            });


            test(`${/*++N*/'001'/**/} отсутствующий ключ — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ noExistKey: number; }>({
                    noExistKey: Configuration.NumberSpec({
                        configKey: 'numberConfig.noExistKey',
                        fallback: 99
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.noExistKey, 99,
                    'noExistKey: должен вернуть фолбек значение');

            });

            test(`${/*++N*/'002'/**/} значение является числом, границ нет — возвращает как есть`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ intKey: number; }>({
                    intKey: Configuration.NumberSpec({
                        configKey: 'numberConfig.intKey',
                        fallback: 0
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.intKey, 42,
                    'intKey: должен вернуть значение из конфигурации');

            });

            test(`${/*++N*/'003'/**/} значение не является числом, границ нет — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ noNumberKey: number; }>({
                    noNumberKey: Configuration.NumberSpec({
                        configKey: 'numberConfig.noNumberKey',
                        fallback: 7
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.noNumberKey, 7,
                    'noNumberKey: не число, должен вернуть фолбек');

            });

            test(`${/*++N*/'004'/**/} значение не является числом, границы заданы — возвращает фолбек, не обрезает`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ noNumberKey: number; }>({
                    noNumberKey: Configuration.NumberSpec({
                        configKey: 'numberConfig.noNumberKey',
                        fallback: 7,
                        min: 0,
                        max: 100
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.noNumberKey, 7,
                    'noNumberKey: не число — фолбек, а не обрезание до границы');

            });

            test(`${/*++N*/'005'/**/} значение в диапазоне [min, max] — возвращает как есть`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ inRangeKey: number; }>({
                    inRangeKey: Configuration.NumberSpec({
                        configKey: 'numberConfig.inRangeKey',
                        fallback: 0,
                        min: 0,
                        max: 100
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.inRangeKey, 50,
                    'inRangeKey: в диапазоне, должен вернуть значение из конфигурации');

            });

            test(`${/*++N*/'006'/**/} значение ниже min — обрезается до min`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ belowMinKey: number; }>({
                    belowMinKey: Configuration.NumberSpec({
                        configKey: 'numberConfig.belowMinKey',
                        fallback: 50,
                        min: 0,
                        max: 100
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.belowMinKey, 0,
                    'belowMinKey: -5 ниже min=0, должен обрезаться до 0');

            });

            test(`${/*++N*/'007'/**/} значение выше max — обрезается до max`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ aboveMaxKey: number; }>({
                    aboveMaxKey: Configuration.NumberSpec({
                        configKey: 'numberConfig.aboveMaxKey',
                        fallback: 50,
                        min: 0,
                        max: 100
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.aboveMaxKey, 100,
                    'aboveMaxKey: 150 выше max=100, должен обрезаться до 100');

            });

            test(`${/*++N*/'008'/**/} значение равно min — возвращает как есть, не считается "ниже"`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ atMinKey: number; }>({
                    atMinKey: Configuration.NumberSpec({
                        configKey: 'numberConfig.atMinKey',
                        fallback: 50,
                        min: 10,
                        max: 100
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.atMinKey, 10,
                    'atMinKey: 10 === min=10, должен вернуть 10 без изменений');

            });

            test(`${/*++N*/'009'/**/} значение равно max — возвращает как есть, не считается "выше"`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ atMaxKey: number; }>({
                    atMaxKey: Configuration.NumberSpec({
                        configKey: 'numberConfig.atMaxKey',
                        fallback: 50,
                        min: 0,
                        max: 100
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.atMaxKey, 100,
                    'atMaxKey: 100 === max=100, должен вернуть 100 без изменений');

            });

        });
    });
});
