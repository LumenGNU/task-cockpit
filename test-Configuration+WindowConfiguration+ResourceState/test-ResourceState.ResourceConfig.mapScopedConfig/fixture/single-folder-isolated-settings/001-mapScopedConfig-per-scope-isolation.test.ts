import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Scope from 'src/ResourceState/Scope';
import ScopeKey from 'src/ScopeKey';
import mapScopedConfig from 'src/ResourceState/ResourceConfig/mapScopedConfig';
import Configuration from 'src/Configuration';

interface Settings {
    value: string;
}

const SETTINGS_SCHEMA = Configuration.createSchema<Settings>({
    value: Configuration.StringSpec({
        configKey: 'extConfig.key',
        fallback: 'default-value'
    })
});

// `${/*N=0*/'000'/**/}`

suite('ResourceState', function () {

    suite('ResourceConfig', function () {

        suite('mapScopedConfig', function () {

            suiteSetup(async function () {
                const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
                assert.ok(ext);
                await ext.activate();

                // --- Контракт фикстуры ---
                assert.ok(!vscode.workspace.workspaceFile);
                assert.equal(vscode.workspace.name, 'single-folder-isolated-settings');
                assert.ok(vscode.workspace.workspaceFolders?.length === 1, `ожидали каталогов в проекте 1, получено ${vscode.workspace.workspaceFolders?.length}`);

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


            suite('mapScopedConfig корректно изолирует задачи по областям в single-folder проекте', function () {

                const scopedConfigMap = mapScopedConfig(scopeLayout_moc, SETTINGS_SCHEMA);

                test(`${/*++N*/'001'/**/} конфигурация глобальной области (User) изолируется от остальных`, function () {

                    const globalSettings = scopedConfigMap.get(ScopeKey.GLOBAL_KEY);
                    assert.equal(globalSettings?.value, 'value-from-global');

                });

                test(`${/*++N*/'002'/**/} конфигурация рабочей области (workspace) отсутствует`, function () {

                    assert.equal(scopedConfigMap.get(ScopeKey.WORKSPACE_KEY), undefined);

                });

                test(`${/*++N*/'003'/**/} конфигурация папки проекта со своими настройками изолируется от глобальной`, function () {

                    const projectFolderSettings = scopedConfigMap.get(folderKeys[0]!);
                    assert.equal(projectFolderSettings?.value, 'value-from-project-folder');
                });

            });

        });
    });
});
