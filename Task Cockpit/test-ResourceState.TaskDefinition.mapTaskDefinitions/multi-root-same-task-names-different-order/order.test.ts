import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import ScopeKey from '../../src/ScopeKey';
import mapTaskDefinitions from '../../src/ResourceState/TaskDefinition/mapTaskDefinitions';
import ScopeLayout from '../../src/ResourceState/ScopeLayout';

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
                assert.equal(vscode.workspace.name, 'multi-root-same-task-names-different-order (Workspace)');
                assert.ok(vscode.workspace.workspaceFolders?.length === 2, `ожидали каталогов в проекте 2, получено ${vscode.workspace.workspaceFolders?.length}`);

            });

            const scopeLayout = ScopeLayout.getLayout();

            suite('mapTaskDefinitions гарантирует порядок на основе порядка из файла-источника', function () {

                const taskDefinitionMap = mapTaskDefinitions(scopeLayout);

                test(`${/*++N*/'001'/**/} для global scope порядок сохраняется`, function () {

                    const globalNames = [...taskDefinitionMap.get(ScopeKey.GLOBAL_KEY)!.keys()];
                    assert.deepEqual(globalNames, [
                        'task-in-user-profile',
                        '3',
                        '1',
                        '2',
                        'task C',
                        'task A',
                        'task B',
                    ]);

                });

                test(`${/*++N*/'002'/**/} для workspace scope порядок сохраняется`, function () {

                    const workspaceNames = [...taskDefinitionMap.get(ScopeKey.WORKSPACE_KEY)!.keys()];
                    assert.deepEqual(workspaceNames, [
                        'task A',
                        'task B',
                        'task C',
                        '1',
                        '2',
                        '3',
                    ]);
                });

                test(`${/*++N*/'003'/**/} для folder1 scope порядок сохраняется`, function () {

                    const folderKey = scopeLayout.folderScopes![0]!.key;

                    const folder1Names = [...taskDefinitionMap.get(folderKey)!.keys()];
                    assert.deepEqual(folder1Names, [
                        'task B',
                        'task A',
                        'task C',
                        '2',
                        '1',
                        '3',
                    ]);
                });

                test(`${/*++N*/'004'/**/} для folder2 scope порядок сохраняется`, function () {

                    const folderKey = scopeLayout.folderScopes![1]!.key;

                    const folder2Names = [...taskDefinitionMap.get(folderKey)!.keys()];
                    assert.deepEqual(folder2Names, [
                        'task C',
                        'task B',
                        'task A',
                        '3',
                        '2',
                        '1',
                    ]);
                });

            });

        });
    });
});
