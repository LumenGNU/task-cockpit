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

                const [primaKey] = scopeLayout.folderScopes!.map(f => f.key);

                assert.ok(primaKey);

                const taskDefinitions = mapTaskDefinitions(scopeLayout);

                const MY_TASK = 'My Task' as TaskName;

                const U_myTask = taskDefinitions.get(ScopeKey.GLOBAL_KEY)?.get(MY_TASK);
                assert.equal(taskDefinitions.get(ScopeKey.WORKSPACE_KEY), undefined);
                const P_myTask = taskDefinitions.get(primaKey)?.get(MY_TASK);


                test('single-folder-conflicts-between-user-level', function () {

                    // Где "My Task" доступен
                    assert.ok(U_myTask);
                    assert.ok(P_myTask);

                    // Что отображается
                    assert.ok(U_myTask.active);
                    assert.equal(P_myTask.active, null);

                    // Что затеняется
                    assert.equal(U_myTask.shadowed, undefined);
                    assert.deepEqual(P_myTask.shadowed?.map(d => d.taskName), ['My Task']);
                });

            });
        });
    });
});
