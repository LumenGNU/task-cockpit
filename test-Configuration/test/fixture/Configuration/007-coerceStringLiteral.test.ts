import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import { Configuration, OptionType } from 'src/Configuration/Configuration';

// В settings.json:
// "stringLiteralConfig": {
//     "themeKey": "dark",
//     "noThemeKey": 42,
//     "unknownTheme": "purple"
// }

suite('Configuration', function () {

    suite('get', function () {

        suite('coerceStringLiteral (валидация строковых литералов)', function () {

            type Theme = 'light' | 'dark' | 'system';
            const themeValues = ['light', 'dark', 'system'] as const;

            let workspaceConfiguration: vscode.WorkspaceConfiguration;

            suiteSetup(function () {
                workspaceConfiguration = vscode.workspace.getConfiguration('stringLiteralConfig');

                assert.ok(!workspaceConfiguration.get('noExistKey'),
                    'pre: stringLiteralConfig.noExistKey не должно быть в конфигурации');

                assert.equal(workspaceConfiguration.get('themeKey'), 'dark',
                    'pre: stringLiteralConfig.themeKey должен присутствовать и иметь значение "dark"');

                assert.equal(typeof workspaceConfiguration.get('noThemeKey'), 'number',
                    'pre: stringLiteralConfig.noThemeKey должен присутствовать и быть числом');

                assert.equal(workspaceConfiguration.get('unknownTheme'), 'purple',
                    'pre: stringLiteralConfig.unknownTheme должен присутствовать и не входить в допустимые значения');
            });


            test(`${/*++N*/'001'/**/} отсутствующий ключ — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<{ noExistKey: Theme; }>({
                    noExistKey: { from: '.', type: OptionType.StringLiteral, spec: { fallback: 'light', values: themeValues } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.noExistKey, 'light',
                    'noExistKey: должен вернуть фолбек значение');
            });


            test(`${/*++N*/'002'/**/} значение входит в values — возвращает как есть`, function () {

                const schema = Configuration.createSchema<{ themeKey: Theme; }>({
                    themeKey: { from: '.', type: OptionType.StringLiteral, spec: { fallback: 'light', values: themeValues } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.themeKey, 'dark',
                    'themeKey: должен вернуть значение из конфигурации');
            });


            test(`${/*++N*/'003'/**/} значение не является строкой — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<{ noThemeKey: Theme; }>({
                    noThemeKey: { from: '.', type: OptionType.StringLiteral, spec: { fallback: 'light', values: themeValues } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.noThemeKey, 'light',
                    'noThemeKey: должен вернуть фолбек значение');
            });


            test(`${/*++N*/'004'/**/} значение является строкой, но не входит в values — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<{ unknownTheme: Theme; }>({
                    unknownTheme: { from: '.', type: OptionType.StringLiteral, spec: { fallback: 'light', values: themeValues } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.unknownTheme, 'light',
                    'unknownTheme: значение не входит в values, должен вернуть фолбек');
            });
        });
    });
});
