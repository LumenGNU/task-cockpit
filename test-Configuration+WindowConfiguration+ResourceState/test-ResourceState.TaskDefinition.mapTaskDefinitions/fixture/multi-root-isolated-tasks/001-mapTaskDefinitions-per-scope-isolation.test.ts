import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Scope from 'src/ResourceState/Scope';
import ScopeKey from 'src/ScopeKey';
import mapTaskDefinitions from 'src/ResourceState/TaskDefinition/mapTaskDefinitions';

// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suite('TaskDefinition', function () {

        suite('mapTaskDefinitions', function () {

            suiteSetup(async function () {
                const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
                assert.ok(ext);
                await ext.activate();

                // --- Контракт фикстуры ---
                assert.ok(vscode.workspace.workspaceFile);
                assert.equal(vscode.workspace.name, 'multi-root-isolated-tasks (Workspace)');
                assert.ok(vscode.workspace.workspaceFolders?.length === 2, `ожидали каталогов в проекте 2, получено ${vscode.workspace.workspaceFolders?.length}`);

            });


            const scopeLayout_moc: Scope.ScopeLayout = {
                [ScopeKey.GLOBAL_KEY]: {
                    name: 'User',
                    taskSource: null
                },
                [ScopeKey.WORKSPACE_KEY]: {
                    name: 'workspace (Workspace)',
                    taskSource: null,
                },
                folders: vscode.workspace.workspaceFolders!.reduce((obj, folder) => {
                    const key = folder.uri.toString() as ScopeKey.FolderKey;
                    const taskSource = {
                        uri: vscode.Uri.joinPath(folder.uri, '.vscode', 'tasks.json') as Scope.SourceUri,
                        JSONPath: ['tasks']
                    };
                    obj[key] = { taskSource, ...folder };
                    return obj;
                }, {} as { [k: ScopeKey.FolderKey]: Scope.FolderScope; })
            };

            const folderKeys = vscode.workspace.workspaceFolders!.map((folder) => folder.uri.toString() as ScopeKey.FolderKey);


            suite('mapTaskDefinitions корректно изолирует задачи по областям в multi-root проекте', function () {

                const taskDefinitionMap = mapTaskDefinitions(scopeLayout_moc);

                test(`${/*++N*/'001'/**/} задачи global scope изолированы`, function () {

                    const globalTasks = [...taskDefinitionMap.get(ScopeKey.GLOBAL_KEY)!.keys()];
                    assert.ok(globalTasks.length > 0); // в user-profile несколько задач, на все тесты
                    assert.equal(globalTasks[0], 'task-in-user-profile');

                });

                test(`${/*++N*/'002'/**/} задачи workspace scope изолированы`, function () {

                    const workspaceTasks = [...taskDefinitionMap.get(ScopeKey.WORKSPACE_KEY)!.keys()];
                    assert.equal(workspaceTasks.length, 1);
                    assert.equal(workspaceTasks[0], 'task-in-workspace');
                });

                test(`${/*++N*/'003'/**/} задачи folder1 scope изолированы`, function () {

                    const folder1Tasks = [...taskDefinitionMap.get(folderKeys[0]!)!.keys()];
                    assert.equal(folder1Tasks.length, 1);
                    assert.equal(folder1Tasks[0], 'task-in-folder1');
                });

                test(`${/*++N*/'004'/**/} задачи folder2 scope изолированы`, function () {

                    const folder2Tasks = [...taskDefinitionMap.get(folderKeys[1]!)!.keys()];
                    assert.equal(folder2Tasks.length, 1);
                    assert.equal(folder2Tasks[0], 'task-in-folder2');
                });

            });

        });
    });
});
