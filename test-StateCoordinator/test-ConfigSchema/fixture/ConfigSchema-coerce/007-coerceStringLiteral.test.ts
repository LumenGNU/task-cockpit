import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import { createSchema, SpecType, coerce } from 'src/StateCoordinator/ConfigSchema/ConfigSchema';

// В settings.json:
// "stringLiteralConfig": {
//     "themeKey": "dark",
//     "noThemeKey": 42,
//     "unknownTheme": "purple"
// }

suite('ConfigSchema', function () {


    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });


    suite('coerce', function () {

        suite('coerceStringLiteral (валидация строковых литералов)', function () {

            type Theme = 'light' | 'dark' | 'system';
            const themeValues = ['light', 'dark', 'system'] as const;

            const baseSection = 'stringLiteralConfig';
            const configurationScope = null;

            suiteSetup(function () {
                const workspaceConfiguration = vscode.workspace.getConfiguration(baseSection);

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

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ noExistKey: Theme; }>({
                    noExistKey: { section: '', type: SpecType.StringLiteral, spec: { fallback: 'light', values: themeValues } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.noExistKey, 'light',
                    'noExistKey: должен вернуть фолбек значение');
            });


            test(`${/*++N*/'002'/**/} значение входит в values — возвращает как есть`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ themeKey: Theme; }>({
                    themeKey: { section: '', type: SpecType.StringLiteral, spec: { fallback: 'light', values: themeValues } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.themeKey, 'dark',
                    'themeKey: должен вернуть значение из конфигурации');
            });


            test(`${/*++N*/'003'/**/} значение не является строкой — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ noThemeKey: Theme; }>({
                    noThemeKey: { section: '', type: SpecType.StringLiteral, spec: { fallback: 'light', values: themeValues } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.noThemeKey, 'light',
                    'noThemeKey: должен вернуть фолбек значение');
            });


            test(`${/*++N*/'004'/**/} значение является строкой, но не входит в values — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ unknownTheme: Theme; }>({
                    unknownTheme: { section: '', type: SpecType.StringLiteral, spec: { fallback: 'light', values: themeValues } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.unknownTheme, 'light',
                    'unknownTheme: значение не входит в values, должен вернуть фолбек');
            });
        });
    });
});
