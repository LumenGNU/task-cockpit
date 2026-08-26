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

        // ---
        assert.ok(vscode.workspace.name);
        assert.ok(vscode.workspace.workspaceFile);
    });

    suite('ScopeLayout', function () {

        suite('workspaceScope', function () {

            const scopeLayout = ProjectLayout.getLayout();

            test(`${/*++N*/'001'/**/} Секция workspaceScope, multi-root проект`, function () {

                assert.deepEqual(scopeLayout.workspace, {
                    key: OriginKey.WORKSPACE,
                    name: vscode.workspace.name,
                    taskSource: {
                        uri: vscode.workspace.workspaceFile,
                        JSONPath: ['tasks', 'tasks']
                    }
                });

            });


        });
    });

});
