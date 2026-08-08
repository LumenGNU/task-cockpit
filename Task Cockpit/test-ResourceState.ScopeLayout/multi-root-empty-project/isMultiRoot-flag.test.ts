import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ScopeLayout from '../../src/ResourceState/ScopeLayout';


// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();


    });

    suite('ScopeLayout', function () {

        suite('isMultiRoot', function () {

            const scopeLayout = ScopeLayout.getLayout();

            test(`${/*++N*/'001'/**/} multi-root проект, без папок — isMultiRoot = true`, function () {

                assert.equal(scopeLayout.isMultiRoot, true);

            });


        });
    });

});
