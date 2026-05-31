import * as assert from 'assert/strict';
import Splitter from 'src/TreeModel/Splitter';

// `${/*N=0*/'000'/**/}`

suite('Cockpit', function () {

    suite('TreeModel', function () {

        suite('Splitter', function () {

            suite('constructor — разбиение отключено', function () {

                test(`${/*++N*/'001'/**/} false → split() возвращает [input]`, function () {
                    const s = Splitter.create(false);
                    assert.deepStrictEqual(s.split('a/b/c'), ['a/b/c']);
                });

                test(`${/*++N*/'002'/**/} пустая строка → split() возвращает [input]`, function () {
                    const s = Splitter.create('');
                    assert.deepStrictEqual(s.split('a/b/c'), ['a/b/c']);
                });

                test(`${/*++N*/'003'/**/} пробел как разделитель → отключено (trimStart)`, function () {
                    const s = Splitter.create(' ');
                    assert.deepStrictEqual(s.split('a b c'), ['a b c']);
                });

                test(`${/*++N*/'004'/**/} табуляция как разделитель → отключено (trimStart)`, function () {
                    const s = Splitter.create('\t');
                    assert.deepStrictEqual(s.split('a\tb\tc'), ['a\tb\tc']);
                });

                test(`${/*++N*/'005'/**/} первый символ — пробел → отключено, остальные игнорируются`, function () {
                    // ' /' → delimiter[0] = ' ', trimStart() → '' → falsy
                    const s = Splitter.create(' /');
                    assert.deepStrictEqual(s.split('a/b/c'), ['a/b/c']);
                });

            });


            suite('constructor — выбор символа-разделителя', function () {

                test(`${/*++N*/'006'/**/} используется только первый символ строки`, function () {
                    const s = Splitter.create('/|');
                    assert.deepStrictEqual(s.split('a/b|c'), ['a', 'b|c'],
                        'разбиение только по /, | — не разделитель');
                });

            });


            suite('split() — базовое поведение', function () {

                test(`${/*++N*/'007'/**/} строка без разделителя → один элемент`, function () {
                    const s = Splitter.create('/');
                    assert.deepStrictEqual(s.split('abc'), ['abc']);
                });

                test(`${/*++N*/'008'/**/} пустая строка → ['']`, function () {
                    const s = Splitter.create('/');
                    assert.deepStrictEqual(s.split(''), ['']);
                });

                test(`${/*++N*/'009'/**/} два сегмента`, function () {
                    const s = Splitter.create('/');
                    assert.deepStrictEqual(s.split('a/b'), ['a', 'b']);
                });

                test(`${/*++N*/'010'/**/} три сегмента`, function () {
                    const s = Splitter.create('/');
                    assert.deepStrictEqual(s.split('a/b/c'), ['a', 'b', 'c']);
                });

            });


            suite('split() — контекстные правила', function () {

                test(`${/*++N*/'011'/**/} пробел слева от разделителя → нет разбиения`, function () {
                    const s = Splitter.create('/');
                    assert.deepStrictEqual(s.split('a /b'), ['a /b']);
                });

                test(`${/*++N*/'012'/**/} пробел справа от разделителя → нет разбиения`, function () {
                    const s = Splitter.create('/');
                    assert.deepStrictEqual(s.split('a/ b'), ['a/ b']);
                });

                test(`${/*++N*/'013'/**/} пробелы с обеих сторон → нет разбиения`, function () {
                    const s = Splitter.create('/');
                    assert.deepStrictEqual(s.split('a / b'), ['a / b']);
                });

                test(`${/*++N*/'014'/**/} разделитель в начале строки → сохраняется в первом сегменте`, function () {
                    const s = Splitter.create('/');
                    assert.deepStrictEqual(s.split('/a/b'), ['/a', 'b']);
                });

                test(`${/*++N*/'015'/**/} разделитель в конце строки → сохраняется в последнем сегменте`, function () {
                    const s = Splitter.create('/');
                    assert.deepStrictEqual(s.split('a/b/'), ['a', 'b/']);
                });

                test(`${/*++N*/'016'/**/} разделитель только на границах → нет разбиения`, function () {
                    const s = Splitter.create('/');
                    assert.deepStrictEqual(s.split('/abc/'), ['/abc/']);
                });

                test(`${/*++N*/'017'/**/} двойной разделитель → нет разбиения`, function () {
                    const s = Splitter.create('/');
                    assert.deepStrictEqual(s.split('a//b'), ['a//b']);
                });

                test(`${/*++N*/'018'/**/} двойной разделитель внутри длинного пути`, function () {
                    const s = Splitter.create('/');
                    // второй // не срабатывает, первый / между a и b — срабатывает
                    assert.deepStrictEqual(s.split('a/b//c'), ['a', 'b//c']);
                });

            });


            suite('split() — спецсимволы RegExp как разделитель', function () {

                test(`${/*++N*/'019'/**/} точка '.' как разделитель`, function () {
                    const s = Splitter.create('.');
                    assert.deepStrictEqual(s.split('a.b.c'), ['a', 'b', 'c']);
                });

                test(`${/*++N*/'020'/**/} звёздочка '*' как разделитель`, function () {
                    const s = Splitter.create('*');
                    assert.deepStrictEqual(s.split('a*b*c'), ['a', 'b', 'c']);
                });

                test(`${/*++N*/'021'/**/} квадратная скобка '[' как разделитель`, function () {
                    const s = Splitter.create('[');
                    assert.deepStrictEqual(s.split('a[b[c'), ['a', 'b', 'c']);
                });

                test(`${/*++N*/'022'/**/} вертикальная черта '|' как разделитель`, function () {
                    const s = Splitter.create('|');
                    assert.deepStrictEqual(s.split('a|b|c'), ['a', 'b', 'c']);
                });

            });

        });
    });
});