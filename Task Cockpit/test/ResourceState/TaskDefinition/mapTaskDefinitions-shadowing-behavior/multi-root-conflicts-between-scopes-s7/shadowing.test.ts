import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ScopeKey from '../../../../../src/ScopeKey';
import mapTaskDefinitions from '../../../../../src/ResourceState/TaskDefinition/mapTaskDefinitions';
import ScopeLayout from '../../../../../src/ResourceState/ScopeLayout';
import type TaskName from '../../../../../src/TaskName';



suite('ResourceState', function () {

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();

    });

    suite('TaskDefinition', function () {

        suite('mapTaskDefinitions', function () {

            suite('Shadowing behavior', function () {

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


                test('multi-root-conflicts-between-scopes-s7', function () {

                    // Где "My Task" доступен
                    assert.ok(!U_myTask);
                    assert.ok(!W_myTask);
                    assert.ok(P_myTask);
                    assert.ok(F2_myTask);

                    // Что отображается
                    assert.ok(P_myTask.active);
                    assert.ok(F2_myTask.active);

                    // Что затеняется
                    assert.deepEqual(P_myTask.shadowed, undefined);
                    assert.equal(F2_myTask.shadowed, undefined);

                });

            });
        });
    });
});
