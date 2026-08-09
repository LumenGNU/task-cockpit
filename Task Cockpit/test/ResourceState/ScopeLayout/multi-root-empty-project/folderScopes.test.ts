import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ScopeLayout from '../../../../src/ResourceState/ScopeLayout';


// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suiteSetup(async function () {

        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();

        // ---
        assert.ok(vscode.workspace.workspaceFolders?.length === 0);

    });

    suite('ScopeLayout', function () {

        suite('folderScopes', function () {

            const scopeLayout = ScopeLayout.getLayout();
            const { folderScopes } = scopeLayout;


            test(`${/*++N*/'001'/**/} Секция folderScopes, multi-root проект без папок`, function () {

                assert.ok(folderScopes);
                assert.equal(folderScopes.length, 0);

            });

        });
    });

});
