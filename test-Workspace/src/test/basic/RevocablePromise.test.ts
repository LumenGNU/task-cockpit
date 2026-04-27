import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import RevocablePromise from '../../../Workspace/RevocablePromise';


describe('runCancellable', () => {


    it('resolves with worker value; token not cancelled during run', async () => {
        let seenCancelled: boolean | undefined;
        const { promise } = RevocablePromise.runCancellable(async (token) => {
            seenCancelled = token.isCancellationRequested;
            return 42;
        });
        assert.equal(await promise, 42);
        assert.equal(seenCancelled, false);
    });


    it('revoke rejects with CancellationError and cancels the worker token', async () => {
        let capturedToken: vscode.CancellationToken | undefined;
        const { promise, revoke } = RevocablePromise.runCancellable((token) => {
            capturedToken = token;
            return new Promise<never>((_, rej) =>
                token.onCancellationRequested(() => rej(new vscode.CancellationError()))
            );
        });
        revoke();
        await assert.rejects(promise, vscode.CancellationError);
        assert.equal(capturedToken?.isCancellationRequested, true);
    });


    it('revoke after resolve is a no-op', async () => {
        const { promise, revoke } = RevocablePromise.runCancellable(async () => 'done');
        assert.equal(await promise, 'done');
        assert.doesNotThrow(() => revoke());
        assert.equal(await promise, 'done');
    });


    it('multiple revoke() calls are idempotent', async () => {
        const { promise, revoke } = RevocablePromise.runCancellable(
            (token) => new Promise<never>((_, rej) =>
                token.onCancellationRequested(() => rej(new vscode.CancellationError()))
            )
        );
        revoke();
        assert.doesNotThrow(() => { revoke(); revoke(); });
        await assert.rejects(promise, vscode.CancellationError);
    });


    it('worker-initiated cancellation surfaces as CancellationError', async () => {
        const { promise } = RevocablePromise.runCancellable(async () => {
            throw new vscode.CancellationError();
        });
        await assert.rejects(promise, vscode.CancellationError);
    });

});