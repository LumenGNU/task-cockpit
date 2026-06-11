
import FileDecorationProvider from 'src/DecorationProvider/FileDecorationProvider';
import type UriSchema from 'src/DecorationProvider/UriSchema';
import * as assert from 'assert/strict';
import {
    Uri,
    CancellationTokenSource,
    ThemeColor,
    type CancellationToken,
    CancellationError
} from 'vscode';
import type UriQuery from 'src/DecorationProvider/UriQuery';


function uriFrom(query: UriQuery) {
    return Uri.from({
        scheme: 'task-cockpit',
        authority: 'Node',
        path: '',
        query: (new URLSearchParams(query)).toString()
    } satisfies UriSchema);
}

function isThenable<T>(value: T | Thenable<T>): value is Thenable<T> {
    return value != null && typeof (value as Thenable<T>).then === 'function';
}

const conf = {
    runningSymbol: '●',
    overflowSymbol: '+',
    badgeOrder: 'symbolFirst',
    availableSymbol: '•'
} as const;

// `${/*N=0*/'000'/**/}`

suite('FileDecorationProvider', function () {


    let fileDecorationProvider: FileDecorationProvider;
    let cts: CancellationTokenSource;
    let token: CancellationToken;

    setup(function () {
        cts = new CancellationTokenSource();
        token = cts.token;
        fileDecorationProvider = new FileDecorationProvider(conf);
    });

    teardown(function () {
        cts?.dispose();
        fileDecorationProvider?.dispose();
    });


    suite('URI handle', function () {

        test(`${/*++N*/'001'/**/} не известный uri → undefined`, function () {

            const result = fileDecorationProvider.provideFileDecoration(Uri.from({
                scheme: 'file',
                authority: '//',
                path: '/any',
                query: 'available=1&running=1&color=xxx' // обязательно со значащим query
            }), token);
            assert.equal(result, undefined);
        });


        test(`${/*++N*/'002'/**/} известный uri → НЕ undefined`, function () {

            const result = fileDecorationProvider.provideFileDecoration(Uri.from({
                scheme: 'task-cockpit',
                authority: 'Node',
                path: '',
                query: 'available=1&running=1&color=xxx' // обязательно со значащим query
            } satisfies UriSchema), token);
            assert.ok(result);
        });

    });

    suite('computeDecoration', function () {

        test(`${/*++N*/'003'/**/} "пустой" query → undefined`, function () {

            const uri = uriFrom({ available: '', running: '', color: '' });

            const result = fileDecorationProvider.provideFileDecoration(uri, token);
            assert.equal(result, undefined);

        });

        test(`${/*++N*/'004'/**/} "не значащий" query → undefined`, function () {

            const uri = uriFrom({ available: '0', running: '0', color: '' });

            const result = fileDecorationProvider.provideFileDecoration(uri, token);
            assert.equal(result, undefined);
        });


        suite('badge', function () {


            test(`${/*++N*/'005'/**/} available > 0, running = 0 → •`, function () {

                const uri = uriFrom({ available: '1', running: '0', color: '' });

                const result = fileDecorationProvider.provideFileDecoration(uri, token);
                assert.ok(result);
                assert.ok(!isThenable(result));
                assert.equal(result.badge, '•');

            });

            test(`${/*++N*/'006'/**/} running = 1 → ● (без цифры)`, function () {

                const uri = uriFrom({ available: '0', running: '1', color: '' });

                const result = fileDecorationProvider.provideFileDecoration(uri, token);
                assert.ok(result);
                assert.ok(!isThenable(result));
                assert.equal(result.badge, '●');
            });

            test(`${/*++N*/'007'/**/} running = [2..9]  → ●N (с цифрой)`, function () {

                Array.from({ length: 8 }, function (_, i) { return i + 2; }).forEach(function (N) {

                    const uri = uriFrom({ available: '0', running: `${N}`, color: '' });

                    const result = fileDecorationProvider.provideFileDecoration(uri, token);
                    assert.ok(result);
                    assert.ok(!isThenable(result));
                    assert.equal(result.badge, `●${N}`);
                });
            });


            test(`${/*++N*/'008'/**/} running > 9 → ●+ (overflow)`, function () {

                Array.from({ length: 10 }, function (_, i) { return i + 10; }).forEach(function (N) {

                    const uri = uriFrom({ available: '0', running: `${N}`, color: '' });

                    const result = fileDecorationProvider.provideFileDecoration(uri, token);
                    assert.ok(result);
                    assert.ok(!isThenable(result));
                    assert.equal(result.badge, '●+');
                });
            });

            test(`${/*++N*/'009'/**/} у running приоритет над available`, function () {

                const uri = uriFrom({ available: '999', running: '1', color: '' });

                const result = fileDecorationProvider.provideFileDecoration(uri, token);
                assert.ok(result);
                assert.ok(!isThenable(result));
                assert.equal(result.badge, '●');
            });

        });

        suite('color', function () {

            test(`${/*++N*/'010'/**/} undefined → нет ThemeColor`, function () {

                const uri = uriFrom({ available: '1', running: '1', color: '' });

                const result = fileDecorationProvider.provideFileDecoration(uri, token);
                assert.ok(result);
                assert.ok(!isThenable(result));
                assert.equal(result.color, undefined);
            });

            test(`${/*++N*/'011'/**/} непустая строка → ThemeColor`, function () {

                const uri = uriFrom({ available: '0', running: '0', color: 'list.invalidItemForeground' });

                const result = fileDecorationProvider.provideFileDecoration(uri, token);
                assert.ok(result);
                assert.ok(!isThenable(result));

                assert.ok(result.color instanceof ThemeColor);
            });


            test(`${/*++N*/'012'/**/} любая строка == ThemeColor (поведение VS Code)`, function () {

                const uri = uriFrom({ available: '0', running: '0', color: 'I’m not color!' });

                const result = fileDecorationProvider.provideFileDecoration(uri, token);
                assert.ok(result);
                assert.ok(!isThenable(result));

                assert.ok(result.color instanceof ThemeColor);
            });

        });
    });

    suite('Props', function () {

        test(`${/*++N*/'013'/**/} испускает onDidChangeFileDecorations в ответ на изменение конфигурации`, function () {

            let eventCounter = 0;
            const disposable = fileDecorationProvider.onDidChangeFileDecorations(function () {
                eventCounter++;
            });

            fileDecorationProvider.setConf({ ...conf, availableSymbol: 'x' });
            fileDecorationProvider.setConf({ ...conf, badgeOrder: 'countFirst' });
            fileDecorationProvider.setConf({ ...conf, runningSymbol: '>' });

            assert.equal(eventCounter, 3);

            disposable.dispose();
        });


        test(`${/*++N*/'014'/**/} повторная установка тех же значений → no-op без onDidChangeFileDecorations`, function () {

            let eventCounter = 0;
            const disposable = fileDecorationProvider.onDidChangeFileDecorations(function () {
                eventCounter++;
            });

            fileDecorationProvider.setConf({ ...conf, runningSymbol: '>' });
            fileDecorationProvider.setConf({ ...conf, runningSymbol: '>' });
            fileDecorationProvider.setConf({ ...conf, runningSymbol: '>' });

            assert.equal(eventCounter, 1, 'только первое изменение должно вызвать событие');

            disposable.dispose();

        });


        test(`${/*++N*/'015'/**/} корректно применяет конфигурацию`, function () {

            fileDecorationProvider.setConf({
                runningSymbol: '>',
                overflowSymbol: '!',
                badgeOrder: 'countFirst',
                availableSymbol: '='
            });

            // -----
            const result1 = fileDecorationProvider.provideFileDecoration(
                uriFrom({ available: '0', running: '1', color: '' }),
                token
            );

            assert.ok(result1);
            assert.ok(!isThenable(result1));

            assert.equal(result1.badge, '>');

            // -----
            const result2 = fileDecorationProvider.provideFileDecoration(
                uriFrom({ available: '0', running: '2', color: '' }),
                token
            );

            assert.ok(result2);
            assert.ok(!isThenable(result2));

            assert.equal(result2.badge, '2>');

            // -----
            const result3 = fileDecorationProvider.provideFileDecoration(
                uriFrom({ available: '0', running: '20', color: '' }),
                token
            );

            assert.ok(result3);
            assert.ok(!isThenable(result3));

            assert.equal(result3.badge, '!>');

            // -----
            const result4 = fileDecorationProvider.provideFileDecoration(
                uriFrom({ available: '1', running: '0', color: '' }),
                token
            );

            assert.ok(result4);
            assert.ok(!isThenable(result4));

            assert.equal(result4.badge, '=');

        });

    });


    suite('Отмена через CancellationToken', function () {

        test(`${/*++N*/'016'/**/} уважает CancellationToken`, function () {

            const uri = uriFrom({ available: '1', running: '1', color: 'x' });

            const result = fileDecorationProvider.provideFileDecoration(uri, token);
            assert.ok(result);
            assert.ok(!isThenable(result));
            assert.ok(result); // нормально отработает

            // Отмена "до": синхронный, токен проверяется только в начале
            cts.cancel();

            // повторный запрос с отмененным token
            assert.throws(function () {
                fileDecorationProvider.provideFileDecoration(uri, token);
            }, CancellationError);


        });

    });

});
