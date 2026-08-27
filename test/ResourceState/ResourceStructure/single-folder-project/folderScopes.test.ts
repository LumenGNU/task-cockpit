import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ResourceStructure from '../../../../src/ResourceStateCoordinator/ResourceStructure';
import path from 'node:path';



// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suiteSetup(async function () {

        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();

        // ---

    });

    suite('ResourceStructure', function () {

        suite('folderScopes', function () {

            const resourceStructure = ResourceStructure.build();
            const { folders: folderScopes } = resourceStructure;


            test(`${/*++N*/'001'/**/} Секция folderScopes, single-folder проект`, function () {

                assert.ok(folderScopes);
                assert.equal(folderScopes.length, 1);
                const prima = folderScopes[0]!;
                assert.equal(prima.isPrimary, true);
                assert.ok(prima.taskSource.uri.toString().endsWith(path.join('.vscode', 'tasks.json')));
                assert.deepEqual(prima.taskSource.JSONPath, ['tasks']);

            });

        });
    });

});
