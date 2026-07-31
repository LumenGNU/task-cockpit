import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Configuration from 'src/Configuration';


// В settings.json:
// "existsConfig": {
//     "rootKey": "str-from-config (rootKey)",
//     "existPath": {
//         "existKey": "str-from-config (existKey)"
//     },
//     "multi": {
//         "segment": {
//             "key": "str-from-config (multiSegmentKey)"
//         }
//     }
// }


// `${/*N=0*/'000'/**/}`

suite('Configuration', function () {


    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });


    suite('coerce', function () {


        suiteSetup(function () {

            const workspaceConfiguration = vscode.workspace.getConfiguration();

            assert.equal(typeof workspaceConfiguration.get('existsConfig.existPath.existKey'), 'string',
                'pre: existsConfig.existPath.existKey должен присутствовать и быть строкой');

            assert.equal(typeof workspaceConfiguration.get('existsConfig.rootKey'), 'string',
                'pre: existsConfig.rootKey должен присутствовать и быть строкой');

            assert.equal(typeof workspaceConfiguration.get('existsConfig.multi'), 'object',
                'pre: existsConfig.rootKey должен присутствовать и быть строкой');

            assert.ok(!workspaceConfiguration.get('existsConfig.noExistKey'),
                'pre: existsConfig.noExistKey не должно быть в конфигурации');

        });

        test(`${/*++N*/'001'/**/} возвращает plain object без прототипа`, function () {

            const configObj = vscode.workspace.getConfiguration();

            const schema = Configuration.createSchema<{}>({});

            const result = Configuration.coerce(configObj, schema);

            assert.ok(result);
            assert.equal(Reflect.getPrototypeOf(result), null);
        });


        test(`${/*++N*/'002'/**/} присутствующая конфигурация возвращает значения по указанному пути (один сегмент)`, function () {

            const configObj = vscode.workspace.getConfiguration();

            const schema = Configuration.createSchema<{}>({
                existKey: Configuration.StringSpec({
                    configKey: 'existsConfig.existPath.existKey',
                    fallback: 'def-str'
                })
            });

            const result = Configuration.coerce(configObj, schema);

            assert.ok(result, 'должен вернуть результат');

            // Результатом должно быть
            // {
            //   existKey: value from baseSection.existPath.existKey
            // }

            assert.ok('existKey' in result, 'поле existKey должно присутствовать в результате');
            assert.equal(result.existKey, 'str-from-config (existKey)', 'поле existKey должно иметь значение из конфигурации');

        });


        test(`${/*++N*/'003'/**/} присутствующая конфигурация возвращает значения по указанному пути (несколько сегментов)`, function () {

            const configObj = vscode.workspace.getConfiguration();

            const schema = Configuration.createSchema<{}>({
                key: Configuration.StringSpec({
                    configKey: 'existsConfig.multi.segment.key',
                    fallback: 'def-str'
                })
            });

            const result = Configuration.coerce(configObj, schema);

            assert.ok(result, 'должен вернуть результат');

            // Результатом должно быть
            // {
            //   key: value from baseSection.multi.segment.key
            // }

            assert.ok('key' in result, 'поле key должно присутствовать в результате');
            assert.equal(result.key, 'str-from-config (multiSegmentKey)', 'поле existKey должно иметь значение из конфигурации');

        });

        test(`${/*++N*/'004'/**/} присутствующая конфигурация возвращает значения по указанному пути (нет сегментов, только ключ)`, function () {

            const configObj = vscode.workspace.getConfiguration();

            const schema = Configuration.createSchema<{ rootKey: string; }>({
                rootKey: Configuration.StringSpec({
                    configKey: 'existsConfig.rootKey', fallback: 'def-str'
                })
            });

            const result = Configuration.coerce(configObj, schema);

            assert.equal(result.rootKey, 'str-from-config (rootKey)', 'поле rootKey должно иметь значение из конфигурации');

        });

        test(`${/*++N*/'005'/**/} чтение не существующего ключа — фолбек`, function () {

            const configObj = vscode.workspace.getConfiguration();

            const schema = Configuration.createSchema<{ noExistKey: string; }>({
                noExistKey: Configuration.StringSpec({
                    configKey: 'existsConfig.noExistKey',
                    fallback: 'default-str'
                })
            });

            const result = Configuration.coerce(configObj, schema);

            assert.equal(result.noExistKey, 'default-str', 'поле noExistKey должно иметь значение по умолчанию');

        });

        test(`${/*++N*/'006'/**/} чтение не существующего ключа по не существующему пути — фолбек`, function () {

            const configObj = vscode.workspace.getConfiguration();

            const schema = Configuration.createSchema<{ φ: string; }>({
                φ: Configuration.StringSpec({
                    configKey: 'existsConfig.α.β.γ',
                    fallback: 'default-str'
                })
            });

            const result = Configuration.coerce(configObj, schema);

            assert.equal(result.φ, 'default-str', 'поле со странным именем должно иметь значение по умолчанию');

        });


        test(`${/*++N*/'007'/**/} чтение присутствующей конфигурации, схемма не повторяет структуру конфигурации`, function () {

            const configObj = vscode.workspace.getConfiguration();

            const schema = Configuration.createSchema<{ config: { group: { value: string; }; }; }>({
                config: {
                    group: {
                        value: Configuration.StringSpec({
                            configKey: 'existsConfig.existPath.existKey',
                            fallback: 'def-str'
                        })
                    }
                }
            });

            const result = Configuration.coerce(configObj, schema);

            assert.ok(result, 'должен вернуть результат');

            // Результатом должно быть
            // {
            //   config: {
            //     value: {
            //       existKey: value from baseSection.existPath.existKey
            //     }
            //   }
            // }

            assert.equal(result.config.group.value, 'str-from-config (existKey)', 'поле value должно иметь значение existKey из конфигурации');

        });

    });

});
