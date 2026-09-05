import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import OriginKey from '../../../../../src/OriginKey';
import groupTaskDefinitions from '../../../../../src/ResourceStateCoordinator/TaskDefinition/groupTaskDefinitions';
import ResourceStructure from '../../../../../src/ResourceStateCoordinator/ResourceStructure';

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

            const resourceStructure = ResourceStructure.build();

            suite('mapTaskDefinitions корректно изолирует задачи по областям в multi-root проекте', function () {

                const taskDefinitionMap = groupTaskDefinitions(resourceStructure);

                test(`${/*++N*/'001'/**/} задачи global scope изолированы`, function () {

                    const globalTasks = [...taskDefinitionMap.get(OriginKey.USER)!.keys()];
                    assert.equal(globalTasks.length, 7); // в user-profile несколько задач, на все тесты
                    assert.equal(globalTasks[0], 'task-in-user-profile');

                });

                test(`${/*++N*/'002'/**/} задачи workspace scope изолированы`, function () {

                    const workspaceTasks = [...taskDefinitionMap.get(OriginKey.WORKSPACE)!.keys()];
                    assert.equal(workspaceTasks.length, 1);
                    assert.equal(workspaceTasks[0], 'task-in-workspace');
                });

                test(`${/*++N*/'003'/**/} задачи folder1 scope изолированы`, function () {

                    const folderKey = resourceStructure.folders![0]!.originKey;

                    const folder1Tasks = [...taskDefinitionMap.get(folderKey)!.keys()];
                    assert.equal(folder1Tasks.length, 1);
                    assert.equal(folder1Tasks[0], 'task-in-folder1');
                });

                test(`${/*++N*/'004'/**/} задачи folder2 scope изолированы`, function () {

                    const folderKey = resourceStructure.folders![1]!.originKey;

                    const folder2Tasks = [...taskDefinitionMap.get(folderKey)!.keys()];
                    assert.equal(folder2Tasks.length, 1);
                    assert.equal(folder2Tasks[0], 'task-in-folder2');
                });

            });

        });
    });
});
