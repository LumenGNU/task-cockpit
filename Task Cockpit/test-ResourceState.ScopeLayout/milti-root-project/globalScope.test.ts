import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ScopeLayout from '../../src/ResourceState/ScopeLayout';
import ScopeKey from '../../src/ScopeKey';


// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();


    });

    suite('ScopeLayout', function () {

        suite('globalScope', function () {

            const scopeLayout = ScopeLayout.getLayout();

            test(`${/*++N*/'001'/**/} Секция globalScope всегда присутствует с фиксированным значением`, function () {

                assert.deepEqual(scopeLayout.globalScope, {
                    key: ScopeKey.GLOBAL_KEY,
                    name: 'User',
                    taskSource: null
                });

            });


        });
    });

});
