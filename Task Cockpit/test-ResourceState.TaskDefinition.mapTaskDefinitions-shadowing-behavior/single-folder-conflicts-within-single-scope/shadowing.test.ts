import * as assert from 'assert/strict';
import * as vscode from 'vscode';
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

            suite('Shadowing behavior', function () {

                const scopeLayout = ScopeLayout.getLayout();

                const [primaKey] = scopeLayout.folderScopes!.map(f => f.key);

                assert.ok(primaKey);

                const taskDefinitions = mapTaskDefinitions(scopeLayout);

                const MY_TASK = 'My Task' as TaskName;

                const P_myTask = taskDefinitions.get(primaKey)?.get(MY_TASK);


                test('single-folder-conflicts-within-single-scope', function () {

                    // "My Task" доступен
                    assert.ok(P_myTask);

                    // Что отображается
                    assert.equal(P_myTask.active?.taskName, 'My Task');

                    // Что затеняется
                    assert.deepEqual(P_myTask.shadowed?.map(d => d.taskName), ['My Task', 'My Task']);

                });

                test('Побеждает задача последняя по порядку в файле', function () {
                    assert.ok(P_myTask);
                    assert.equal(P_myTask.active?.icon?.id, 'pos-3');
                });

                test('Список затененных в порядке из файла', function () {
                    assert.ok(P_myTask);
                    assert.deepEqual(P_myTask.shadowed?.map(d => d.icon?.id), ['pos-1', 'pos-2']);
                });

            });
        });
    });
});
