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

            suite('Combined shadowing', function () {

                const scopeLayout = ScopeLayout.getLayout();
                const [primaKey] = scopeLayout.folderScopes!.map(f => f.key);

                assert.ok(primaKey);

                const taskDefinitions = mapTaskDefinitions(scopeLayout);
                const MY_TASK = 'My Task' as TaskName;

                const U_myTask = taskDefinitions.get(ScopeKey.GLOBAL_KEY)?.get(MY_TASK);
                const P_myTask = taskDefinitions.get(primaKey)?.get(MY_TASK);

                // C3: Обе scope имеют within-scope коллизию.
                // User: u-2 побеждает (last wins), u-1 в shadowed.
                // Prima: целиком затенена User — active=null, ОБЕИХ p-1 и p-2 в shadowed,
                // включая p-2 которая была бы "внутренним победителем" при отсутствии User.
                test('multi-root-combined-shadowing-c3: within-scope в User (победитель) и Prima (проигравший)', function () {
                    assert.ok(U_myTask);
                    assert.ok(P_myTask);

                    assert.ok(U_myTask.active);
                    assert.equal(U_myTask.active?.icon?.id, 'u-2');
                    assert.deepEqual(U_myTask.shadowed?.map(d => d.icon?.id), ['u-1']);

                    assert.equal(P_myTask.active, null);
                    assert.deepEqual(P_myTask.shadowed?.map(d => d.icon?.id), ['p-1', 'p-2']);
                });

            });

        });
    });
});
