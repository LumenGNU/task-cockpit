import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ResourceStructure from '../../../../src/ResourceStateCoordinator/ResourceStructure';


// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();


    });

    suite('ResourceStructure', function () {

        suite('isMultiRoot', function () {

            const resourceStructure = ResourceStructure.build();

            test(`${/*++N*/'001'/**/} multi-root проект, без папок — workspaceScope != null`, function () {

                assert.notEqual(resourceStructure.Workspace, null);

            });


        });
    });

});
