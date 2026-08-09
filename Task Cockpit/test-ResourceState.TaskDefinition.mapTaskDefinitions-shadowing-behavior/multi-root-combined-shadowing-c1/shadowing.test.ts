import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ScopeKey from '../../src/ScopeKey';
import mapTaskDefinitions from '../../src/ResourceState/TaskDefinition/mapTaskDefinitions';
import ScopeLayout from '../../src/ResourceState/ScopeLayout';
import type TaskName from '../../src/TaskName';

suite('ResourceState', function () {

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });

    suite('TaskDefinition', function () {
        suite('mapTaskDefinitions', function () {
            suite('Combined shadowing', function () {

                const scopeLayout = ScopeLayout.getLayout();
                const [primaKey, folder2Key] = scopeLayout.folderScopes!.map(f => f.key);

                assert.ok(primaKey);
                assert.ok(folder2Key);

                const taskDefinitions = mapTaskDefinitions(scopeLayout);
                const MY_TASK = 'My Task' as TaskName;

                const U_myTask = taskDefinitions.get(ScopeKey.GLOBAL_KEY)?.get(MY_TASK);
                const W_myTask = taskDefinitions.get(ScopeKey.WORKSPACE_KEY)?.get(MY_TASK);
                const P_myTask = taskDefinitions.get(primaKey)?.get(MY_TASK);
                const F2_myTask = taskDefinitions.get(folder2Key)?.get(MY_TASK);

                // C1: Workspace с двумя My Task полностью затенён User-ом.
                // Гипотеза: active=null, shadowed содержит ОБЕИХ, в порядке файла —
                // включая ту, что победила бы при within-scope.
                test('multi-root-combined-shadowing-c1: within-scope коллизия в затенённом Workspace', function () {
                    assert.ok(U_myTask);
                    assert.ok(W_myTask);
                    assert.ok(!P_myTask);
                    assert.ok(!F2_myTask);

                    assert.ok(U_myTask.active);
                    assert.equal(U_myTask.shadowed, undefined);

                    assert.equal(W_myTask.active, null);
                    assert.deepEqual(W_myTask.shadowed?.map(d => d.icon?.id), ['w-1', 'w-2']);
                });

            });
        });
    });
});
