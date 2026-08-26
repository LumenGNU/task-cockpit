import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ProjectLayout from '../../../../src/ResourceStateCoordinator/ResourceStructure';
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

            const scopeLayout = ProjectLayout.getLayout();
            const { folders: folderScopes } = scopeLayout;


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
