import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ProjectLayout from '../../../../src/ResourceStateCoordinator/ResourceStructure';


// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();


    });

    suite('ScopeLayout', function () {

        suite('workspaceScope', function () {

            const scopeLayout = ProjectLayout.getLayout();

            test(`${/*++N*/'001'/**/} Секция workspaceScope, single-folder проект — null`, function () {

                assert.equal(scopeLayout.workspace, null);

            });


        });
    });

});
