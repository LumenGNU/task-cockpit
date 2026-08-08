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

        // ---
        assert.ok(vscode.workspace.name);
        assert.ok(vscode.workspace.workspaceFile);
    });

    suite('ScopeLayout', function () {

        suite('workspaceScope', function () {

            const scopeLayout = ScopeLayout.getLayout();

            test(`${/*++N*/'001'/**/} Секция workspaceScope, multi-root проект без папок`, function () {

                assert.deepEqual(scopeLayout.workspaceScope, {
                    key: ScopeKey.WORKSPACE_KEY,
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
