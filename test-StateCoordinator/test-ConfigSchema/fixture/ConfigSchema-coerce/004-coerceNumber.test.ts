import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import { createSchema, SpecType, coerce } from 'src/StateCoordinator/ConfigSchema/ConfigSchema';

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


suite('ConfigSchema', function () {


    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });


    suite('coerce', function () {

        suite('coerceNumber (валидация чисел)', function () {

            const baseSection = 'numberConfig';
            const configurationScope = null;

            suiteSetup(function () {
                const workspaceConfiguration = vscode.workspace.getConfiguration(baseSection);

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

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ noExistKey: number; }>({
                    noExistKey: { section: '', type: SpecType.Number, spec: { fallback: 99 } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.noExistKey, 99,
                    'noExistKey: должен вернуть фолбек значение');

            });

            test(`${/*++N*/'002'/**/} значение является числом, границ нет — возвращает как есть`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ intKey: number; }>({
                    intKey: { section: '', type: SpecType.Number, spec: { fallback: 0 } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.intKey, 42,
                    'intKey: должен вернуть значение из конфигурации');

            });

            test(`${/*++N*/'003'/**/} значение не является числом, границ нет — возвращает фолбек`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ noNumberKey: number; }>({
                    noNumberKey: { section: '', type: SpecType.Number, spec: { fallback: 7 } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.noNumberKey, 7,
                    'noNumberKey: не число, должен вернуть фолбек');

            });

            test(`${/*++N*/'004'/**/} значение не является числом, границы заданы — возвращает фолбек, не обрезает`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ noNumberKey: number; }>({
                    noNumberKey: { section: '', type: SpecType.Number, spec: { fallback: 7, min: 0, max: 100 } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.noNumberKey, 7,
                    'noNumberKey: не число — фолбек, а не обрезание до границы');

            });

            test(`${/*++N*/'005'/**/} значение в диапазоне [min, max] — возвращает как есть`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ inRangeKey: number; }>({
                    inRangeKey: { section: '', type: SpecType.Number, spec: { fallback: 0, min: 0, max: 100 } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.inRangeKey, 50,
                    'inRangeKey: в диапазоне, должен вернуть значение из конфигурации');

            });

            test(`${/*++N*/'006'/**/} значение ниже min — обрезается до min`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ belowMinKey: number; }>({
                    belowMinKey: { section: '', type: SpecType.Number, spec: { fallback: 50, min: 0, max: 100 } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.belowMinKey, 0,
                    'belowMinKey: -5 ниже min=0, должен обрезаться до 0');

            });

            test(`${/*++N*/'007'/**/} значение выше max — обрезается до max`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ aboveMaxKey: number; }>({
                    aboveMaxKey: { section: '', type: SpecType.Number, spec: { fallback: 50, min: 0, max: 100 } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.aboveMaxKey, 100,
                    'aboveMaxKey: 150 выше max=100, должен обрезаться до 100');

            });

            test(`${/*++N*/'008'/**/} значение равно min — возвращает как есть, не считается "ниже"`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ atMinKey: number; }>({
                    atMinKey: { section: '', type: SpecType.Number, spec: { fallback: 50, min: 0, max: 100 } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.atMinKey, 0,
                    'atMinKey: 0 === min=0, должен вернуть 0 без изменений');

            });

            test(`${/*++N*/'009'/**/} значение равно max — возвращает как есть, не считается "выше"`, function () {

                const configObj = vscode.workspace.getConfiguration(baseSection, configurationScope);

                const schema = createSchema<{ atMaxKey: number; }>({
                    atMaxKey: { section: '', type: SpecType.Number, spec: { fallback: 50, min: 0, max: 100 } }
                });

                const result = coerce(configObj, schema);

                assert.equal(result.atMaxKey, 100,
                    'atMaxKey: 100 === max=100, должен вернуть 100 без изменений');

            });

        });
    });

});
