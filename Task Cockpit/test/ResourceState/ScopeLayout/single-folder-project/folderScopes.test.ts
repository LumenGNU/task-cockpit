import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ScopeLayout from '../../../../src/ResourceState/ScopeLayout';
import path from 'node:path';



// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suiteSetup(async function () {

        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();

        // ---

    });

    suite('ScopeLayout', function () {

        suite('folderScopes', function () {

            const scopeLayout = ScopeLayout.getLayout();
            const { folderScopes } = scopeLayout;


            test(`${/*++N*/'001'/**/} Секция folderScopes, single-folder проект`, function () {

                assert.ok(folderScopes);
                assert.equal(folderScopes.length, 1);
                const prima = folderScopes[0]!;
                assert.equal(prima.isPrima, true);
                assert.ok(prima.taskSource.uri.toString().endsWith(path.join('.vscode', 'tasks.json')));
                assert.deepEqual(prima.taskSource.JSONPath, ['tasks']);

            });

        });
    });

});
