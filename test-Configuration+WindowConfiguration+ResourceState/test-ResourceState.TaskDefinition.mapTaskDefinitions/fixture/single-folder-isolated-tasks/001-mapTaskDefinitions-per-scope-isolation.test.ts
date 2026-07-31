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
                assert.ok(!vscode.workspace.workspaceFile);
                assert.equal(vscode.workspace.name, 'single-folder-isolated-tasks');
                assert.ok(vscode.workspace.workspaceFolders?.length === 1, `ожидали каталогов в проекте 2, получено ${vscode.workspace.workspaceFolders?.length}`);

            });


            const scopeLayout_moc: Scope.ScopeLayout = {
                [ScopeKey.GLOBAL_KEY]: {
                    name: 'User',
                    taskSource: null
                },
                [ScopeKey.WORKSPACE_KEY]: null,
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


            suite('mapTaskDefinitions корректно изолирует задачи по областям в single-folder проекте', function () {

                const taskDefinitionMap = mapTaskDefinitions(scopeLayout_moc);

                test(`${/*++N*/'001'/**/} задачи global scope изолированы`, function () {

                    const globalTasks = [...taskDefinitionMap.get(ScopeKey.GLOBAL_KEY)!.keys()];
                    assert.ok(globalTasks.length > 0); // в user-profile несколько задач, на все тесты
                    assert.equal(globalTasks[0], 'task-in-user-profile');

                });

                test(`${/*++N*/'002'/**/} задач из workspace scope нет`, function () {

                    assert.equal(taskDefinitionMap.get(ScopeKey.WORKSPACE_KEY), undefined);

                });

                test(`${/*++N*/'003'/**/} задачи project-folder scope изолированы`, function () {

                    const projectFolderTasks = [...taskDefinitionMap.get(folderKeys[0]!)!.keys()];
                    assert.equal(projectFolderTasks.length, 1);
                    assert.equal(projectFolderTasks[0], 'task-in-project-folder');
                });

            });

        });
    });
});
