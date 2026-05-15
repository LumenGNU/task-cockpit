import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import Configuration from '../../../src/Workspace/Settings/Configuration';
import { OptionType } from '../../../src/Workspace/Settings/Configuration';

// В settings.json:
// "booleanConfig": {
//     "trueKey": true,
//     "falseKey": false,
//     "oneKey": 1,
//     "zeroKey": 0,
//     "trueStringKey": "true",
//     "emptyStringKey": ""
// }

interface BooleanConfigSchemaI {
    noExistKey?: boolean;
    trueKey?: boolean;
    falseKey?: boolean;
    oneKey?: boolean;
    zeroKey?: boolean;
    trueStringKey?: boolean;
    emptyStringKey?: boolean;
}

suite('Configuration', function () {

    suite('get', function () {

        suite('coerceBoolean (валидация булевых значений)', function () {

            let workspaceConfiguration: vscode.WorkspaceConfiguration;

            suiteSetup(function () {
                workspaceConfiguration = vscode.workspace.getConfiguration('booleanConfig');

                assert.ok(!workspaceConfiguration.get('noExistKey'),
                    'pre: booleanConfig.noExistKey не должно быть в конфигурации');

                assert.equal(workspaceConfiguration.get('trueKey'), true,
                    'pre: booleanConfig.trueKey должен присутствовать и быть true');

                assert.equal(workspaceConfiguration.get('falseKey'), false,
                    'pre: booleanConfig.falseKey должен присутствовать и быть false');

                assert.equal(workspaceConfiguration.get('oneKey'), 1,
                    'pre: booleanConfig.oneKey должен присутствовать и быть числом 1');

                assert.equal(workspaceConfiguration.get('zeroKey'), 0,
                    'pre: booleanConfig.zeroKey должен присутствовать и быть числом 0');

                assert.equal(workspaceConfiguration.get('trueStringKey'), 'true',
                    'pre: booleanConfig.trueStringKey должен присутствовать и быть строкой "true"');

                assert.equal(workspaceConfiguration.get('emptyStringKey'), '',
                    'pre: booleanConfig.emptyStringKey должен присутствовать и быть пустой строкой');
            });


            test(`${/*++N*/'001'/**/} отсутствующий ключ — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<BooleanConfigSchemaI>({
                    noExistKey: { from: '.', type: OptionType.Boolean, spec: { fallback: true } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.noExistKey, true,
                    'noExistKey: должен вернуть фолбек значение');

            });

            test(`${/*++N*/'002'/**/} значение true — возвращает true`, function () {

                const schema = Configuration.createSchema<BooleanConfigSchemaI>({
                    trueKey: { from: '.', type: OptionType.Boolean, spec: { fallback: false } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.trueKey, true,
                    'trueKey: должен вернуть true из конфигурации');

            });

            test(`${/*++N*/'003'/**/} значение false — возвращает false, не фолбек`, function () {

                // Ловушка: наивная проверка !rawValue вернёт фолбек вместо false
                const schema = Configuration.createSchema<BooleanConfigSchemaI>({
                    falseKey: { from: '.', type: OptionType.Boolean, spec: { fallback: true } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.falseKey, false,
                    'falseKey: false — валидное булево значение, фолбек не должен применяться');

            });

            test(`${/*++N*/'004'/**/} значение 1 (truthy число) — возвращает фолбек, не true`, function () {

                // Ловушка: !!rawValue === true, но 1 — не boolean
                const schema = Configuration.createSchema<BooleanConfigSchemaI>({
                    oneKey: { from: '.', type: OptionType.Boolean, spec: { fallback: false } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.oneKey, false,
                    'oneKey: 1 не является boolean, должен вернуть фолбек');

            });

            test(`${/*++N*/'005'/**/} значение 0 (falsy число) — возвращает фолбек, не false`, function () {

                // Ловушка: выглядит как false, но typeof 0 !== 'boolean'
                const schema = Configuration.createSchema<BooleanConfigSchemaI>({
                    zeroKey: { from: '.', type: OptionType.Boolean, spec: { fallback: true } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.zeroKey, true,
                    'zeroKey: 0 не является boolean, должен вернуть фолбек');

            });

            test(`${/*++N*/'006'/**/} значение "true" (truthy строка) — возвращает фолбек, не true`, function () {

                const schema = Configuration.createSchema<BooleanConfigSchemaI>({
                    trueStringKey: { from: '.', type: OptionType.Boolean, spec: { fallback: false } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.trueStringKey, false,
                    'trueStringKey: строка "true" не является boolean, должен вернуть фолбек');

            });

            test(`${/*++N*/'007'/**/} значение "" (falsy строка) — возвращает фолбек, не false`, function () {

                const schema = Configuration.createSchema<BooleanConfigSchemaI>({
                    emptyStringKey: { from: '.', type: OptionType.Boolean, spec: { fallback: true } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.emptyStringKey, true,
                    'emptyStringKey: пустая строка не является boolean, должен вернуть фолбек');

            });

        });
    });

});