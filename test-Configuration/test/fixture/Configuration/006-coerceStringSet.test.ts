import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import { Configuration, OptionType } from 'src/Configuration/Configuration';

// В settings.json:
// "stringSetConfig": {
//     "stringsOnlyKey": ["apple", "banana", "cherry"],
//     "notArrayStringKey": "not an array",
//     "notArrayNumberKey": 42,
//     "emptyArrayKey": [],
//     "mixedTypesKey": ["alpha", 123, "beta", null, true],
//     "nonStringsOnlyKey": [1, 2, 3],
//     "duplicatesKey": ["a", "b", "a", "c", "b"]
// }


// `${/*N=0*/'000'/**/}`

suite('Configuration', function () {

    suite('get', function () {

        suite('coerceStringSet (валидация множеств строк)', function () {

            let workspaceConfiguration: vscode.WorkspaceConfiguration;

            suiteSetup(function () {
                workspaceConfiguration = vscode.workspace.getConfiguration('stringSetConfig');

                assert.ok(!workspaceConfiguration.get('noExistKey'),
                    'pre: stringSetConfig.noExistKey не должно быть в конфигурации');

                assert.deepEqual(workspaceConfiguration.get('stringsOnlyKey'), ['apple', 'banana', 'cherry'],
                    'pre: stringSetConfig.stringsOnlyKey должен присутствовать и быть массивом строк');

                assert.equal(typeof workspaceConfiguration.get('notArrayStringKey'), 'string',
                    'pre: stringSetConfig.notArrayStringKey должен присутствовать и быть строкой');

                assert.equal(typeof workspaceConfiguration.get('notArrayNumberKey'), 'number',
                    'pre: stringSetConfig.notArrayNumberKey должен присутствовать и быть числом');

                assert.deepEqual(workspaceConfiguration.get('emptyArrayKey'), [],
                    'pre: stringSetConfig.emptyArrayKey должен присутствовать и быть пустым массивом');

                assert.deepEqual(workspaceConfiguration.get('mixedTypesKey'), ['40', '41', 42],
                    'pre: stringSetConfig.mixedTypesKey должен присутствовать и содержать смешанные типы');

                assert.deepEqual(workspaceConfiguration.get('nonStringsOnlyKey'), [1, 2, 3],
                    'pre: stringSetConfig.nonStringsOnlyKey должен присутствовать и содержать только не-строки');

                assert.deepEqual(workspaceConfiguration.get('duplicatesKey'), ['a', 'b', 'a', 'c', 'b'],
                    'pre: stringSetConfig.duplicatesKey должен присутствовать и содержать дубликаты');
            });


            test(`${/*++N*/'001'/**/} отсутствующий ключ — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<{ noExistKey: Set<string>; }>({
                    noExistKey: { from: '.', type: OptionType.StringSet, spec: { fallback: ['x', 'y'] } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.deepEqual(result.noExistKey, new Set(['x', 'y']),
                    'noExistKey: должен вернуть фолбек как Set');

            });

            test(`${/*++N*/'002'/**/} значение является массивом строк — возвращает Set со строками`, function () {

                const schema = Configuration.createSchema<{ stringsOnlyKey: Set<string>; }>({
                    stringsOnlyKey: { from: '.', type: OptionType.StringSet, spec: { fallback: [] } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.deepEqual(result.stringsOnlyKey, new Set(['apple', 'banana', 'cherry']),
                    'stringsOnlyKey: должен вернуть Set из строк конфигурации');

            });

            test(`${/*++N*/'003'/**/} значение не является массивом (строка) — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<{ notArrayStringKey: Set<string>; }>({
                    notArrayStringKey: { from: '.', type: OptionType.StringSet, spec: { fallback: ['fallback'] } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.deepEqual(result.notArrayStringKey, new Set(['fallback']),
                    'notArrayStringKey: строка не массив — должен вернуть фолбек');

            });

            test(`${/*++N*/'004'/**/} значение не является массивом (число) — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<{ notArrayNumberKey: Set<string>; }>({
                    notArrayNumberKey: { from: '.', type: OptionType.StringSet, spec: { fallback: ['fallback'] } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.deepEqual(result.notArrayNumberKey, new Set(['fallback']),
                    'notArrayNumberKey: число не массив — должен вернуть фолбек');

            });

            test(`${/*++N*/'005'/**/} значение является пустым массивом — возвращает пустой Set, не фолбек`, function () {

                const schema = Configuration.createSchema<{ emptyArrayKey: Set<string>; }>({
                    emptyArrayKey: { from: '.', type: OptionType.StringSet, spec: { fallback: ['fallback'] } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.deepEqual(result.emptyArrayKey, new Set(),
                    'emptyArrayKey: пустой массив — валидное значение, не должен возвращать фолбек');

            });

            test(`${/*++N*/'006'/**/} массив содержит смешанные типы — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<{ mixedTypesKey: Set<string>; }>({
                    mixedTypesKey: { from: '.', type: OptionType.StringSet, spec: { fallback: ['fallback'] } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.deepEqual(result.mixedTypesKey, new Set(['fallback']),
                    'mixedTypesKey: не-строки должны быть отброшены, возвращает фолбек');

            });

            test(`${/*++N*/'007'/**/} массив содержит только не строки — возвращает фолбек`, function () {

                const schema = Configuration.createSchema<{ nonStringsOnlyKey: Set<string>; }>({
                    nonStringsOnlyKey: { from: '.', type: OptionType.StringSet, spec: { fallback: ['fallback'] } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.deepEqual(result.nonStringsOnlyKey, new Set(['fallback']),
                    'nonStringsOnlyKey: массив не строк — фолбек');

            });

            test(`${/*++N*/'008'/**/} массив содержит дубликаты — Set схлопывает их`, function () {

                const schema = Configuration.createSchema<{ duplicatesKey: Set<string>; }>({
                    duplicatesKey: { from: '.', type: OptionType.StringSet, spec: { fallback: [] } }
                });

                const result = Configuration.get(schema, workspaceConfiguration);

                assert.deepEqual(result.duplicatesKey, new Set(['a', 'b', 'c']),
                    'duplicatesKey: дубликаты должны отсутствовать Set-ом');

            });

        });
    });

});
