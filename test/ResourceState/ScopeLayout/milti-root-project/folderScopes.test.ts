import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ProjectLayout from '../../../../src/ResourceStateCoordinator/ResourceStructure';


// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suiteSetup(async function () {

        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();

        // ---
        assert.ok(vscode.workspace.workspaceFolders?.length === 2);

    });

    suite('ScopeLayout', function () {

        suite('folderScopes', function () {

            const scopeLayout = ProjectLayout.getLayout();
            const { folders: folderScopes } = scopeLayout;


            test(`${/*++N*/'001'/**/} Секция folderScopes, multi-root проект`, function () {

                assert.ok(folderScopes);
                assert.equal(folderScopes.length, 2);
                const [prima, folder2] = folderScopes;
                assert.ok(prima);
                assert.ok(folder2);
                assert.equal(prima.isPrima, true);
                assert.equal(folder2.isPrima, false);
                assert.equal(prima.name, 'folder1');
                assert.equal(folder2.name, 'folder2');

            });

        });
    });

});
