import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ProjectLayout from '../../../../src/ResourceStateCoordinator/ResourceStructure';
import OriginKey from '../../../../src/OriginKey';


// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();


    });

    suite('ScopeLayout', function () {

        suite('globalScope', function () {

            const scopeLayout = ProjectLayout.getLayout();

            test(`${/*++N*/'001'/**/} Секция globalScope всегда присутствует с фиксированным значением`, function () {

                assert.deepEqual(scopeLayout.global, {
                    key: OriginKey.USER,
                    name: 'User',
                    taskSource: null
                });

            });


        });
    });

});
