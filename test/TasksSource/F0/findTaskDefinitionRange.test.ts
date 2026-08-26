import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type IFixture from '../extension';
import findTaskDefinitionRange from '../../../src/TasksSource/findTaskDefinitionRange';

// `${/*N=0*/'000'/**/}`

const CONTENT = {

    'single-element.jsonc': `[
    {
        "label": "exists"
    }
]`,

    'multiple-elements.jsonc': `[
    {
        "label": "exists1"
    },
    {
        "label": "exists2"
    },
    {
        "label": "exists3"
    }
]`,

    'multiple-elements-duplicates.jsonc': `[
    {
        "label": "exists"
    },
    {
        "label": "exists"
    },
    {
        "label": "exists"
    }
]`,

    'comments-and-trailing-comma.jsonc': `[
    { // build task
        "label": "exists",
    },
]`,

    'deep-path-element.jsonc': `{
    "segment1": {
        "segment2": [
            {
                "label": "exists"
            }
        ]
    }
}`,

    'empty-array.jsonc': `[
]`,

    'no-label.jsonc': `[
    {
        "cmd": "x"
    },
    {
        "cmd": "y"
    }
]`,

    'path-not-found.jsonc': `{
    "foo": "bar"
}`,

    'node-not-array.jsonc': `{
    "tasks": "not an array"
}`,

    'empty-content.jsonc': ``,

    'invalid-json.jsonc': `{ invalid`,

    'label-non-string.jsonc': `[
    {
        "label": 123
    }
]`,

    'label-nested.jsonc': `[
    {
        "nested": {
            "label": "exists"
        }
    }
]`,

    'leading-spaces.jsonc': `   [ { "label": "exists" } ]`,

    'empty-label-match.jsonc': `[
    {
        "label": ""
    }
]`,

};

suite('findTaskDefinitionRange', function () {

    let fixture: IFixture;

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);

        fixture = await ext.activate();
        assert.ok(fixture);
    });

    suite('Базовые', function () {

        suite('положительные случаи', function () {

            test(`${/*++N*/'001'/**/} Один элемент: находит совпадение по label`, async function () {
                const result = findTaskDefinitionRange(CONTENT['single-element.jsonc'], [], 'exists');
                assert.deepEqual(result, { start: 6, end: 39 });
            });

            test(`${/*++N*/'002'/**/} Несколько элементов: находит соответствующий label`, async function () {
                const result1 = findTaskDefinitionRange(CONTENT['multiple-elements.jsonc'], [], 'exists1');
                assert.deepEqual(result1, { start: 6, end: 40 });
                const result2 = findTaskDefinitionRange(CONTENT['multiple-elements.jsonc'], [], 'exists2');
                assert.deepEqual(result2, { start: 46, end: 80 });
                const result3 = findTaskDefinitionRange(CONTENT['multiple-elements.jsonc'], [], 'exists3');
                assert.deepEqual(result3, { start: 86, end: 120 });
            });

            test(`${/*++N*/'003'/**/} Дубликаты: выбирается последний совпавший label`, async function () {
                const result = findTaskDefinitionRange(CONTENT['multiple-elements-duplicates.jsonc'], [], 'exists');
                assert.deepEqual(result, { start: 84, end: 117 });
            });

            test(`${/*++N*/'004'/**/} JSONC: корректная работа с комментариями и запятыми`, async function () {
                const result = findTaskDefinitionRange(CONTENT['comments-and-trailing-comma.jsonc'], [], 'exists');
                assert.deepEqual(result, { start: 6, end: 54 });
            });

            test(`${/*++N*/'005'/**/} JSONPath с несколькими сегментами: поиск внутри вложенных сегментов`, async function () {
                const result = findTaskDefinitionRange(CONTENT['deep-path-element.jsonc'], ['segment1', 'segment2'], 'exists');
                assert.deepEqual(result, { start: 54, end: 103 });
            });

            test(`${/*++N*/'006'/**/} Ведущие пробелы: корректный расчёт offset`, async function () {
                const result = findTaskDefinitionRange(CONTENT['leading-spaces.jsonc'], [], 'exists');
                assert.deepEqual(result, { start: 5, end: 26 });
            });

            test(`${/*++N*/'007'/**/} Совпадение с пустой строкой label`, async function () {
                const result = findTaskDefinitionRange(CONTENT['empty-label-match.jsonc'], [], '');
                assert.deepEqual(result, { start: 6, end: 33 });
            });

            test(`${/*++N*/'008'/**/} Большой массив: находит последний элемент и работает быстро`, async function () {
                // Генерируем массив из 1000 задач, где последняя имеет нужный label
                const tasks = Array.from({ length: 999 }, (_, i) => `{ "label": "task${i}" }`).join(',\n    ');
                const content = `[\n    ${tasks},\n    { "label": "target" }\n]`;
                const startTime = Date.now();
                const result = findTaskDefinitionRange(content, [], 'target');
                const endTime = Date.now();
                assert.deepEqual(result, { start: 27868, end: 27889 });
                assert.ok(endTime - startTime < 100, 'Должно выполняться быстро');
            });

        });

        suite('отрицательные случаи', function () {

            test(`${/*++N*/'009'/**/} Пустой массив: результат отсутствует`, async function () {
                const result = findTaskDefinitionRange(CONTENT['empty-array.jsonc'], [], 'any');
                assert.equal(result, null);
            });

            test(`${/*++N*/'010'/**/} Нет совпадений: возвращается null`, async function () {
                const result = findTaskDefinitionRange(CONTENT['multiple-elements.jsonc'], [], 'no-exists');
                assert.equal(result, null);
            });

            test(`${/*++N*/'011'/**/} Задачи без поля label: возвращается null`, async function () {
                const result = findTaskDefinitionRange(CONTENT['no-label.jsonc'], [], 'any');
                assert.equal(result, null);
            });

            test(`${/*++N*/'012'/**/} JSONPath не найден: возвращается null`, async function () {
                const result = findTaskDefinitionRange(CONTENT['path-not-found.jsonc'], ['tasks'], 'any');
                assert.equal(result, null);
            });

            test(`${/*++N*/'013'/**/} Узел по JSONPath не массив: возвращается null`, async function () {
                const result = findTaskDefinitionRange(CONTENT['node-not-array.jsonc'], ['tasks'], 'any');
                assert.equal(result, null);
            });

            test(`${/*++N*/'014'/**/} Пустой контент: возвращается null`, async function () {
                const result = findTaskDefinitionRange(CONTENT['empty-content.jsonc'], [], 'any');
                assert.equal(result, null);
            });

            test(`${/*++N*/'015'/**/} Невалидный JSON: возвращается null`, async function () {
                const result = findTaskDefinitionRange(CONTENT['invalid-json.jsonc'], [], 'any');
                assert.equal(result, null);
            });

            test(`${/*++N*/'016'/**/} label не строка: возвращается null`, async function () {
                const result = findTaskDefinitionRange(CONTENT['label-non-string.jsonc'], [], '123');
                assert.equal(result, null);
            });

            test(`${/*++N*/'017'/**/} label во вложенном объекте: возвращается null`, async function () {
                const result = findTaskDefinitionRange(CONTENT['label-nested.jsonc'], [], 'exists');
                assert.equal(result, null);
            });

        });

    });

});
