import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import mapTaskDefinitions from 'src/StateCoordinator/TaskDefinition/mapTaskDefinitions';
import WorkspaceScope from 'src/Scope/Workspace/Workspace';
import FolderScope from 'src/Scope/Folder/Folder';
import getKey from 'src/Scope/getKey';

suite('TaskDefinition', function () {


    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });

    // --- Контракт фикстуры ---

    suite('mapTaskDefinitions', () => {

        test('порядок определений в карте соответствует порядку определений в файле', async () => {

            const workspaceScope = WorkspaceScope;
            const folders = vscode.workspace.workspaceFolders;

            const folder1Scope = folders?.at(0) as FolderScope;
            assert.ok(folder1Scope);
            const folder2Scope = folders?.at(1) as FolderScope;
            assert.ok(folder2Scope);

            const taskDefinitions = mapTaskDefinitions([workspaceScope, folder1Scope, folder2Scope]);

            assert.deepEqual([...taskDefinitions.keys()], [
                getKey(WorkspaceScope),
                getKey(folder1Scope),
                getKey(folder2Scope),
            ]);

            const workspaceScopeMap = taskDefinitions.get(getKey(workspaceScope));
            assert.ok(workspaceScopeMap);
            assert.deepEqual([...workspaceScopeMap.keys()], ['task A', 'task B', 'task C']);

            const folder1ScopeMap = taskDefinitions.get(getKey(folder1Scope));
            assert.ok(folder1ScopeMap);
            assert.deepEqual([...folder1ScopeMap.keys()], ['task B', 'task A', 'task C']);

            const folder2ScopeMap = taskDefinitions.get(getKey(folder2Scope));
            assert.ok(folder2ScopeMap);
            assert.deepEqual([...folder2ScopeMap.keys()], ['task C', 'task B', 'task A']);

        });

    });

});
