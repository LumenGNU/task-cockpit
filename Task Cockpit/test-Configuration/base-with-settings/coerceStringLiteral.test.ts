import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Configuration from '../../src/Configuration';


// В settings.json:
// "stringLiteralConfig": {
//     "themeKey": "dark",
//     "noThemeKey": 42,
//     "unknownTheme": "purple"
// }

suite('Configuration', function () {


    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });


    suite('coerce', function () {

        suite('coerceStringLiteral (валидация строковых литералов)', function () {

            type Theme = 'light' | 'dark' | 'system';
            const themeValues = ['light', 'dark', 'system'] as const;

            // const baseSection = 'stringLiteralConfig';
            // const configurationScope = null;

            suiteSetup(function () {
                const workspaceConfiguration = vscode.workspace.getConfiguration();

                assert.ok(!workspaceConfiguration.get('stringLiteralConfig.noExistKey'),
                    'pre: stringLiteralConfig.noExistKey не должно быть в конфигурации');

                assert.equal(workspaceConfiguration.get('stringLiteralConfig.themeKey'), 'dark',
                    'pre: stringLiteralConfig.themeKey должен присутствовать и иметь значение "dark"');

                assert.equal(typeof workspaceConfiguration.get('stringLiteralConfig.noThemeKey'), 'number',
                    'pre: stringLiteralConfig.noThemeKey должен присутствовать и быть числом');

                assert.equal(workspaceConfiguration.get('stringLiteralConfig.unknownTheme'), 'purple',
                    'pre: stringLiteralConfig.unknownTheme должен присутствовать и не входить в допустимые значения');
            });


            test(`${/*++N*/'001'/**/} отсутствующий ключ — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ noExistKey: Theme; }>({
                    noExistKey: Configuration.StringLiteralSpec({
                        configKey: 'stringLiteralConfig.noExistKey',
                        fallback: 'light',
                        values: themeValues
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.noExistKey, 'light',
                    'noExistKey: должен вернуть фолбек значение');
            });


            test(`${/*++N*/'002'/**/} значение входит в values — возвращает как есть`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ themeKey: Theme; }>({
                    themeKey: Configuration.StringLiteralSpec({
                        configKey: 'stringLiteralConfig.themeKey',
                        fallback: 'light',
                        values: themeValues
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.themeKey, 'dark',
                    'themeKey: должен вернуть значение из конфигурации');
            });


            test(`${/*++N*/'003'/**/} значение не является строкой — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ noThemeKey: Theme; }>({
                    noThemeKey: Configuration.StringLiteralSpec({
                        configKey: 'stringLiteralConfig.noThemeKey',
                        fallback: 'light',
                        values: themeValues
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.noThemeKey, 'light',
                    'noThemeKey: должен вернуть фолбек значение');
            });


            test(`${/*++N*/'004'/**/} значение является строкой, но не входит в values — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration();

                const schema = Configuration.createSchema<{ unknownTheme: Theme; }>({
                    unknownTheme: Configuration.StringLiteralSpec({
                        configKey: 'stringLiteralConfig.unknownTheme',
                        fallback: 'light',
                        values: themeValues
                    })
                });

                const result = Configuration.coerce(configObj, schema);

                assert.equal(result.unknownTheme, 'light',
                    'unknownTheme: значение не входит в values, должен вернуть фолбек');
            });
        });
    });
});
