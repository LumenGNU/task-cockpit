import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import TaskDefinitions from 'src/Configuration/TaskDefinitions';
import WorkspaceScope from 'src/Scope/Workspace/Workspace';
import FolderScope from 'src/Scope/Folder/Folder';

suite('TaskDefinitions', function () {

    // --- Контракт фикстуры ---

    suite('buildTaskDefinitionsMap', () => {

        test('порядок определений в карте соответствует порядку определений в файле', async () => {

            const workspaceScope = WorkspaceScope;
            const workspaceMap = TaskDefinitions.buildTaskDefinitionsMap(workspaceScope);
            assert.deepEqual([...workspaceMap.keys()], ['task A', 'task B', 'task C']);

            const folders = vscode.workspace.workspaceFolders;

            const folder1Scope = folders?.at(0);
            assert.ok(folder1Scope);
            const folder1Map = TaskDefinitions.buildTaskDefinitionsMap(folder1Scope as FolderScope);
            assert.deepEqual([...folder1Map.keys()], ['task B', 'task A', 'task C']);

            const folder2Scope = folders?.at(1);
            assert.ok(folder2Scope);
            const folder2Map = TaskDefinitions.buildTaskDefinitionsMap(folder2Scope as FolderScope);
            assert.deepEqual([...folder2Map.keys()], ['task C', 'task B', 'task A']);

        });

    });

    suite('buildAvailableNames', function () {

        test('порядок имен в сете соответствует порядку определений в файле', async () => {

            const workspaceScope = WorkspaceScope;
            const workspaceSet = TaskDefinitions.buildAvailableNames(workspaceScope);
            assert.deepEqual([...workspaceSet.keys()], ['task A', 'task B', 'task C']);

            const folders = vscode.workspace.workspaceFolders;

            const folder1Scope = folders?.at(0);
            assert.ok(folder1Scope);
            const folder1Set = TaskDefinitions.buildTaskDefinitionsMap(folder1Scope as FolderScope);
            assert.deepEqual([...folder1Set.keys()], ['task B', 'task A', 'task C']);

            const folder2Scope = folders?.at(1);
            assert.ok(folder2Scope);
            const folder2Set = TaskDefinitions.buildTaskDefinitionsMap(folder2Scope as FolderScope);
            assert.deepEqual([...folder2Set.keys()], ['task C', 'task B', 'task A']);

        });
    });
});
