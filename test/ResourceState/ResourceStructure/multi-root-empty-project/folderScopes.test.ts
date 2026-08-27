import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ResourceStructure from '../../../../src/ResourceStateCoordinator/ResourceStructure';


// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suiteSetup(async function () {

        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();

        // ---
        assert.ok(vscode.workspace.workspaceFolders?.length === 0);

    });

    suite('ResourceStructure', function () {

        suite('folderScopes', function () {

            const resourceStructure = ResourceStructure.build();
            const { folders: folderScopes } = resourceStructure;


            test(`${/*++N*/'001'/**/} Секция folderScopes, multi-root проект без папок`, function () {

                assert.ok(folderScopes);
                assert.equal(folderScopes.length, 0);

            });

        });
    });

});
