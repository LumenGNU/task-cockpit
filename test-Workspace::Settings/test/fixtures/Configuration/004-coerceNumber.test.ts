import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import Configuration from '../../../src/Workspace/Settings/Configuration';
import { OptionType } from '../../../src/Workspace/Settings/Configuration';

// В settings.json:
// "numberConfig": {
//     "intKey": 42,
//     "noNumberKey": "forty-two",
//     "inRangeKey": 50,
//     "belowMinKey": -5,
//     "aboveMaxKey": 150,
//     "atMinKey": 0,
//     "atMaxKey": 100
// }

interface NumberConfigSchemaI {
    noExistKey?: number;
    intKey?: number;
    noNumberKey?: number;
    inRangeKey?: number;
    belowMinKey?: number;
    aboveMaxKey?: number;
    atMinKey?: number;
    atMaxKey?: number;
}

suite('Configuration', function () {

    suite('get', function () {

        suite('coerceNumber (валидация чисел)', function () {

            let workspaceConfiguration: vscode.WorkspaceConfiguration;

            suiteSetup(function () {
                workspaceConfiguration = vscode.workspace.getConfiguration('numberConfig');

                assert.ok(!workspaceConfiguration.get('noExistKey'),
                    'pre: numberConfig.noExistKey не должно быть в конфигурации');

                assert.equal(typeof workspaceConfiguration.get('intKey'), 'number',
                    'pre: numberConfig.intKey должен присутствовать и быть числом');

                assert.equal(workspaceConfiguration.get('intKey'), 42,
                    'pre: numberConfig.intKey должен равняться 42');

                assert.equal(typeof workspaceConfiguration.get('noNumberKey'), 'string',
                    'pre: numberConfig.noNumberKey должен присутствовать и быть строкой');

                assert.equal(workspaceConfiguration.get('inRangeKey'), 50,
                    'pre: numberConfig.inRangeKey должен присутствовать и быть 50 (в диапазоне [0, 100])');

                assert.equal(workspaceConfiguration.get('belowMinKey'), -5,
                    'pre: numberConfig.belowMinKey должен присутствовать и быть -5 (ниже min=0)');

                assert.equal(workspaceConfiguration.get('aboveMaxKey'), 150,
                    'pre: numberConfig.aboveMaxKey должен присутствовать и быть 150 (выше max=100)');

                assert.equal(workspaceConfiguration.get('atMinKey'), 0,
                    'pre: numberConfig.atMinKey должен присутствовать и быть 0 (равен min)');

                assert.equal(workspaceConfiguration.get('atMaxKey'), 100,
                    'pre: numberConfig.atMaxKey должен присутствовать и быть 100 (равен max)');
            });


            test(`${/*++N*/'001'/**/} отсутствующий ключ — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<NumberConfigSchemaI>({
                    noExistKey: { from: '.', type: OptionType.Number, spec: { fallback: 99 } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.noExistKey, 99,
                    'noExistKey: должен вернуть фолбек значение');

            });

            test(`${/*++N*/'002'/**/} значение является числом, границ нет — возвращает как есть`, function () {

                const schema = Configuration.createSchema<NumberConfigSchemaI>({
                    intKey: { from: '.', type: OptionType.Number, spec: { fallback: 0 } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.intKey, 42,
                    'intKey: должен вернуть значение из конфигурации');

            });

            test(`${/*++N*/'003'/**/} значение не является числом, границ нет — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<NumberConfigSchemaI>({
                    noNumberKey: { from: '.', type: OptionType.Number, spec: { fallback: 7 } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.noNumberKey, 7,
                    'noNumberKey: не число, должен вернуть фолбек');

            });

            test(`${/*++N*/'004'/**/} значение не является числом, границы заданы — возвращает фолбек, не обрезает`, function () {

                const schema = Configuration.createSchema<NumberConfigSchemaI>({
                    noNumberKey: { from: '.', type: OptionType.Number, spec: { fallback: 7, min: 0, max: 100 } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.noNumberKey, 7,
                    'noNumberKey: не число — фолбек, а не обрезание до границы');

            });

            test(`${/*++N*/'005'/**/} значение в диапазоне [min, max] — возвращает как есть`, function () {

                const schema = Configuration.createSchema<NumberConfigSchemaI>({
                    inRangeKey: { from: '.', type: OptionType.Number, spec: { fallback: 0, min: 0, max: 100 } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.inRangeKey, 50,
                    'inRangeKey: в диапазоне, должен вернуть значение из конфигурации');

            });

            test(`${/*++N*/'006'/**/} значение ниже min — обрезается до min`, function () {

                const schema = Configuration.createSchema<NumberConfigSchemaI>({
                    belowMinKey: { from: '.', type: OptionType.Number, spec: { fallback: 50, min: 0, max: 100 } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.belowMinKey, 0,
                    'belowMinKey: -5 ниже min=0, должен обрезаться до 0');

            });

            test(`${/*++N*/'007'/**/} значение выше max — обрезается до max`, function () {

                const schema = Configuration.createSchema<NumberConfigSchemaI>({
                    aboveMaxKey: { from: '.', type: OptionType.Number, spec: { fallback: 50, min: 0, max: 100 } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.aboveMaxKey, 100,
                    'aboveMaxKey: 150 выше max=100, должен обрезаться до 100');

            });

            test(`${/*++N*/'008'/**/} значение равно min — возвращает как есть, не считается "ниже"`, function () {

                const schema = Configuration.createSchema<NumberConfigSchemaI>({
                    atMinKey: { from: '.', type: OptionType.Number, spec: { fallback: 50, min: 0, max: 100 } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.atMinKey, 0,
                    'atMinKey: 0 === min=0, должен вернуть 0 без изменений');

            });

            test(`${/*++N*/'009'/**/} значение равно max — возвращает как есть, не считается "выше"`, function () {

                const schema = Configuration.createSchema<NumberConfigSchemaI>({
                    atMaxKey: { from: '.', type: OptionType.Number, spec: { fallback: 50, min: 0, max: 100 } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.equal(result.atMaxKey, 100,
                    'atMaxKey: 100 === max=100, должен вернуть 100 без изменений');

            });

        });
    });

});