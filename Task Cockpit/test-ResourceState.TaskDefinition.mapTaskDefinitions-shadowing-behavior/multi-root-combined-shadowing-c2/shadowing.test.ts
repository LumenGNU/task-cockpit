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
                const P_myTask = taskDefinitions.get(primaKey)?.get(MY_TASK);
                const F2_myTask = taskDefinitions.get(folder2Key)?.get(MY_TASK);

                // C2: Folder2 с двумя My Task изолирована — cross-scope shadowing (User над Prima)
                // не затрагивает Folder2. Внутри Folder2 работает стандартный within-scope: last wins.
                test('multi-root-combined-shadowing-c2: within-scope в folder2 изолирован от cross-scope', function () {
                    assert.ok(U_myTask);
                    assert.ok(!P_myTask);
                    assert.ok(F2_myTask);

                    assert.ok(U_myTask.active);
                    assert.equal(U_myTask.shadowed, undefined);

                    assert.ok(F2_myTask.active);
                    assert.equal(F2_myTask.active?.icon?.id, 'f2-2');
                    assert.deepEqual(F2_myTask.shadowed?.map(d => d.icon?.id), ['f2-1']);
                });

            });
        });
    });
});
