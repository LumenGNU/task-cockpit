import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import RevocablePromise from 'src/utils/RevocablePromise';

// `${/*N=0*/'000'/**/}`

suite('utils', function () {

    suite('RevocablePromise', function () {


        suite('runCancellable', function () {


            test(`${/*++N*/'001'/**/} выполняется со значением workerʼа; токен не аннулирован во время выполнения`, async function () {

                let seenCancelled: boolean | undefined;
                const { promise } = RevocablePromise.runCancellable(async (token) => {
                    seenCancelled = token.isCancellationRequested;
                    return 42;
                });

                assert.equal(await promise, 42);

                assert.equal(seenCancelled, false);

            });


            test(`${/*++N*/'002'/**/} отменяет отклоненные запросы с ошибкой CancellationError и аннулирует токен workerʼа`, async function () {

                let capturedToken: vscode.CancellationToken | undefined;
                const { promise, revoke } = RevocablePromise.runCancellable((token) => {
                    capturedToken = token;
                    return new Promise<never>((_, rej) =>
                        token.onCancellationRequested(() => rej(new vscode.CancellationError()))
                    );
                });

                revoke();

                await assert.rejects(promise, vscode.CancellationError);

                assert.ok(capturedToken, 'worker должен был получить токен');
                assert.equal(capturedToken.isCancellationRequested, true);
            });


            test(`${/*++N*/'003'/**/} отмена после выполнения resolve не приводит к каким-либо действиям`, async function () {

                const { promise, revoke } = RevocablePromise.runCancellable(async () => 'done');

                assert.equal(await promise, 'done');

                assert.doesNotThrow(() => revoke());

                assert.equal(await promise, 'done');
            });


            test(`${/*++N*/'004'/**/} несколько вызовов revoke() являются идемпотентными`, async function () {

                const { promise, revoke } = RevocablePromise.runCancellable(
                    (token) => new Promise<never>((_, rej) =>
                        token.onCancellationRequested(() => rej(new vscode.CancellationError()))
                    )
                );

                revoke();

                assert.doesNotThrow(() => { revoke(); revoke(); });

                await assert.rejects(promise, vscode.CancellationError);
            });


            test(`${/*++N*/'005'/**/} проброс исключения — worker бросает CancellationError, и promise с ним отклоняется`, async function () {

                const { promise } = RevocablePromise.runCancellable(async () => {
                    throw new vscode.CancellationError();
                });

                await assert.rejects(promise, vscode.CancellationError);
            });

        });
    });
});
