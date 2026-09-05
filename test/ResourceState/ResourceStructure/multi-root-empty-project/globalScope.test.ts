import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ResourceStructure from '../../../../src/ResourceStateCoordinator/ResourceStructure';
import OriginKey from '../../../../src/OriginKey';


// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();


    });

    suite('ResourceStructure', function () {

        suite('globalScope', function () {

            const resourceStructure = ResourceStructure.build();

            test(`${/*++N*/'001'/**/} Секция globalScope всегда присутствует с фиксированным значением`, function () {

                assert.deepEqual(resourceStructure.User, {
                    originKey: OriginKey.USER,
                    name: 'User',
                    taskSource: null
                });

            });


        });
    });

});
