import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ScopeKey from '../../../../../src/ScopeKey';
import mapTaskDefinitions from '../../../../../src/ResourceState/TaskDefinition/mapTaskDefinitions';
import ScopeLayout from '../../../../../src/ResourceState/ScopeLayout';

// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suite('TaskDefinition', function () {

        suite('mapTaskDefinitions', function () {

            suiteSetup(async function () {
                const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
                assert.ok(ext);
                await ext.activate();

                // --- Контракт фикстуры ---
                assert.ok(!vscode.workspace.workspaceFile);
                assert.equal(vscode.workspace.name, 'single-folder-isolated-tasks');
                assert.ok(vscode.workspace.workspaceFolders?.length === 1);

            });

            const scopeLayout = ScopeLayout.getLayout();

            suite('mapTaskDefinitions корректно изолирует задачи по областям в single-folder проекте', function () {

                const taskDefinitionMap = mapTaskDefinitions(scopeLayout);

                test(`${/*++N*/'001'/**/} задачи global scope изолированы`, function () {

                    const globalTasks = [...taskDefinitionMap.get(ScopeKey.GLOBAL_KEY)!.keys()];
                    assert.equal(globalTasks.length, 7); //
                    assert.equal(globalTasks[0], 'task-in-user-profile');

                });

                test(`${/*++N*/'002'/**/} задач из workspace scope нет`, function () {

                    assert.equal(taskDefinitionMap.get(ScopeKey.WORKSPACE_KEY), undefined);

                });

                test(`${/*++N*/'003'/**/} задачи project-folder scope изолированы`, function () {

                    const projectFolderTasks = [...taskDefinitionMap.get(scopeLayout.folderScopes![0]!.key)!.keys()];
                    assert.equal(projectFolderTasks.length, 1);
                    assert.equal(projectFolderTasks[0], 'task-in-project-folder');
                });

            });

        });
    });
});
