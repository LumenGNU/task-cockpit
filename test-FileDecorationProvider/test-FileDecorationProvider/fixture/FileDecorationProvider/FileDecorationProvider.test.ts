
import FileDecorationProvider from 'src/DecorationProvider/FileDecorationProvider';
import type UriSchema from 'src/DecorationProvider/UriSchema';
import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import {
    Uri,
    CancellationTokenSource,
    ThemeColor,
    type CancellationToken,
    CancellationError
} from 'vscode';
import type UriQuery from 'src/DecorationProvider/UriQuery';
import { IFixture } from 'src/extension-test';


// @todo
// Добавить тест на dispose():
// после dispose → provideFileDecoration → undefined;
// смена конфига после dispose не должна эмитить (или эмитит — зафиксировать поведение).
// @todo
// Добавить кейсы:
// scheme правильный, authority нет → undefined;
// только tintColor без available/running → есть color, badge undefined;
// badgeOrder: 'countFirst' для running=1, 5, 15;
// propagate === false.

function uriFrom(query: UriQuery) {
    return Uri.from({
        scheme: 'task-cockpit',
        authority: 'Node',
        path: '',
        query: (new URLSearchParams(query as any)).toString()
    } satisfies UriSchema);
}

function isThenable<T>(value: T | Thenable<T>): value is Thenable<T> {
    return value != null && typeof (value as Thenable<T>).then === 'function';
}

const initialConf = {
    runningSymbol: '●',
    overflowSymbol: '+',
    badgeOrder: 'symbolFirst',
    availableSymbol: '•'
} as const;

// `${/*N=0*/'000'/**/}`

suite('FileDecorationProvider', function () {

    let fixture: IFixture;

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        fixture = await ext.activate();

        assert.ok(fixture);
        assert.ok(fixture.fileDecorationProvider instanceof FileDecorationProvider, '');

        await fixture.updateConfig(initialConf);
    });


    let cts: CancellationTokenSource;
    let token: CancellationToken;


    setup(function () {
        cts = new CancellationTokenSource();
        token = cts.token;
    });


    teardown(async function () {
        cts?.dispose();
        await fixture.updateConfig(initialConf);
    });


    suite('URI handle', function () {

        test(`${/*++N*/'001'/**/} не известный uri → undefined`, function () {

            const result = fixture.fileDecorationProvider.provideFileDecoration(Uri.from({
                scheme: 'file',
                authority: '//',
                path: '/any',
                query: 'available=1&running=1&color=xxx' // обязательно со значащим query
            }), token);
            assert.equal(result, undefined);
        });


        test(`${/*++N*/'002'/**/} известный uri → НЕ undefined`, function () {

            const result = fixture.fileDecorationProvider.provideFileDecoration(Uri.from({
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

            const uri = uriFrom({ available: '', running: '', tintColor: '' });

            const result = fixture.fileDecorationProvider.provideFileDecoration(uri, token);
            assert.equal(result, undefined);

        });

        test(`${/*++N*/'004'/**/} "не значащий" query → undefined`, function () {

            const uri = uriFrom({ available: '0', running: '0', tintColor: '' });

            const result = fixture.fileDecorationProvider.provideFileDecoration(uri, token);
            assert.equal(result, undefined);
        });


        suite('badge', function () {


            test(`${/*++N*/'005'/**/} available > 0, running = 0 → ${initialConf.availableSymbol}`, function () {

                const uri = uriFrom({ available: '1', running: '0', tintColor: '' });

                const result = fixture.fileDecorationProvider.provideFileDecoration(uri, token);
                assert.ok(result);
                assert.ok(!isThenable(result));
                assert.equal(result.badge, initialConf.availableSymbol);

            });

            test(`${/*++N*/'006'/**/} running = 1 → ${initialConf.runningSymbol} (без цифры)`, function () {

                const uri = uriFrom({ available: '0', running: '1', tintColor: '' });

                const result = fixture.fileDecorationProvider.provideFileDecoration(uri, token);
                assert.ok(result);
                assert.ok(!isThenable(result));
                assert.equal(result.badge, initialConf.runningSymbol);
            });

            test(`${/*++N*/'007'/**/} running = [2..9]  → ${initialConf.runningSymbol}N (с цифрой)`, function () {

                Array.from({ length: 8 }, function (_, i) { return i + 2; }).forEach(function (N) {

                    const uri = uriFrom({ available: '0', running: `${N}`, tintColor: '' });

                    const result = fixture.fileDecorationProvider.provideFileDecoration(uri, token);
                    assert.ok(result);
                    assert.ok(!isThenable(result));
                    assert.equal(result.badge, `${initialConf.runningSymbol}${N}`);
                });
            });


            test(`${/*++N*/'008'/**/} running > 9 → ${initialConf.runningSymbol}${initialConf.overflowSymbol} (overflow)`, function () {

                Array.from({ length: 10 }, function (_, i) { return i + 10; }).forEach(function (N) {

                    const uri = uriFrom({ available: '0', running: `${N}`, tintColor: '' });

                    const result = fixture.fileDecorationProvider.provideFileDecoration(uri, token);
                    assert.ok(result);
                    assert.ok(!isThenable(result));
                    assert.equal(result.badge, `${initialConf.runningSymbol}${initialConf.overflowSymbol}`);
                });
            });

            test(`${/*++N*/'009'/**/} у running приоритет над available`, function () {

                const uri = uriFrom({ available: '999', running: '1', tintColor: '' });

                const result = fixture.fileDecorationProvider.provideFileDecoration(uri, token);
                assert.ok(result);
                assert.ok(!isThenable(result));
                assert.equal(result.badge, initialConf.runningSymbol);
            });

        });

        suite('color', function () {

            test(`${/*++N*/'010'/**/} undefined → нет ThemeColor`, function () {

                const uri = uriFrom({ available: '1', running: '1', tintColor: '' });

                const result = fixture.fileDecorationProvider.provideFileDecoration(uri, token);
                assert.ok(result);
                assert.ok(!isThenable(result));
                assert.equal(result.color, undefined);
            });

            test(`${/*++N*/'011'/**/} непустая строка → ThemeColor`, function () {

                const uri = uriFrom({ available: '0', running: '0', tintColor: 'list.invalidItemForeground' });

                const result = fixture.fileDecorationProvider.provideFileDecoration(uri, token);
                assert.ok(result);
                assert.ok(!isThenable(result));

                assert.ok(result.color instanceof ThemeColor);
                assert.equal(result.color.id, 'list.invalidItemForeground');
            });


            test(`${/*++N*/'012'/**/} любая строка == ThemeColor (поведение VS Code)`, function () {

                const uri = uriFrom({ available: '0', running: '0', tintColor: 'I’m not color!' });

                const result = fixture.fileDecorationProvider.provideFileDecoration(uri, token);
                assert.ok(result);
                assert.ok(!isThenable(result));

                assert.ok(result.color instanceof ThemeColor);
            });

        });
    });

    suite('Применение конфигурации', function () {

        test(`${/*++N*/'013'/**/} испускает onDidChangeFileDecorations в ответ на изменение конфигурации`, async function () {

            let eventCounter = 0;
            const disposable = fixture.fileDecorationProvider.onDidChangeFileDecorations(function () {
                eventCounter++;
            });

            // обязательно новые значения
            await fixture.updateConfig({
                ...initialConf,
                availableSymbol: 'x',
            });

            await fixture.updateConfig({
                ...initialConf,
                badgeOrder: 'countFirst',
            });

            await fixture.updateConfig({
                ...initialConf,
                runningSymbol: '>'
            });

            assert.equal(eventCounter, 3);

            disposable.dispose();

        }).timeout(3_000); // может занять время



        test(`${/*++N*/'014'/**/} корректно применяет конфигурацию`, async function () {

            await fixture.updateConfig({
                runningSymbol: '>',
                overflowSymbol: '!',
                badgeOrder: 'countFirst',
                availableSymbol: '='
            });

            // -----
            const result1 = fixture.fileDecorationProvider.provideFileDecoration(
                uriFrom({ available: '0', running: '1', tintColor: '' }),
                token
            );

            assert.ok(result1);
            assert.ok(!isThenable(result1));

            assert.equal(result1.badge, '>');

            // -----
            const result2 = fixture.fileDecorationProvider.provideFileDecoration(
                uriFrom({ available: '0', running: '2', tintColor: '' }),
                token
            );

            assert.ok(result2);
            assert.ok(!isThenable(result2));

            assert.equal(result2.badge, '2>');

            // -----
            const result3 = fixture.fileDecorationProvider.provideFileDecoration(
                uriFrom({ available: '0', running: '20', tintColor: '' }),
                token
            );

            assert.ok(result3);
            assert.ok(!isThenable(result3));

            assert.equal(result3.badge, '!>');

            // -----
            const result4 = fixture.fileDecorationProvider.provideFileDecoration(
                uriFrom({ available: '1', running: '0', tintColor: '' }),
                token
            );

            assert.ok(result4);
            assert.ok(!isThenable(result4));

            assert.equal(result4.badge, '=');

        });

    });


    suite('Отмена через CancellationToken', function () {

        test(`${/*++N*/'015'/**/} уважает CancellationToken`, function () {

            const uri = uriFrom({ available: '1', running: '1', tintColor: 'x' });

            const result = fixture.fileDecorationProvider.provideFileDecoration(uri, token);
            assert.ok(result);
            assert.ok(!isThenable(result));
            assert.ok(result); // нормально отработает

            // Отмена "до": синхронный, токен проверяется только в начале
            cts.cancel();

            // запрос с отмененным token — CancellationError
            assert.throws(
                () => { fixture.fileDecorationProvider.provideFileDecoration(uri, token); },
                CancellationError
            );


        });

    });

});
