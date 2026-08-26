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

        suite('isMultiRoot', function () {

            const scopeLayout = ProjectLayout.getLayout();

            test(`${/*++N*/'001'/**/} multi-root проект, без папок — workspaceScope != null`, function () {

                assert.notEqual(scopeLayout.workspace, null);

            });


        });
    });

});
