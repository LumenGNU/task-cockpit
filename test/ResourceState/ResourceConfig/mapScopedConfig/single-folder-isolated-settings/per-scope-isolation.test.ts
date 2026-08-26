import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import OriginKey from '../../../../../src/OriginKey';
import groupResourceConfig from '../../../../../src/ResourceStateCoordinator/ResourceConfig/groupResourceConfig';
import Configuration from '../../../../../src/Configuration';


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

        suite('groupResourceConfig', function () {

            suiteSetup(async function () {
                const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
                assert.ok(ext);
                await ext.activate();

                // --- Контракт фикстуры ---
                assert.ok(!vscode.workspace.workspaceFile);
                assert.equal(vscode.workspace.name, 'single-folder-isolated-settings');
                assert.ok(vscode.workspace.workspaceFolders?.length === 1, `ожидали каталогов в проекте 1, получено ${vscode.workspace.workspaceFolders?.length}`);

            });



            const folderKeys = vscode.workspace.workspaceFolders!.map((folder) => folder.uri.toString() as OriginKey.Folder);


            suite('groupResourceConfig корректно изолирует задачи по областям в single-folder проекте', function () {

                const scopedConfigMap = groupResourceConfig(scopeLayout_moc, SETTINGS_SCHEMA);

                test(`${/*++N*/'001'/**/} конфигурация глобальной области (User) изолируется от остальных`, function () {

                    const globalSettings = scopedConfigMap.get(OriginKey.USER);
                    assert.equal(globalSettings?.value, 'value-from-global');

                });

                test(`${/*++N*/'002'/**/} конфигурация рабочей области (workspace) отсутствует`, function () {

                    assert.equal(scopedConfigMap.get(OriginKey.WORKSPACE), undefined);

                });

                test(`${/*++N*/'003'/**/} конфигурация папки проекта со своими настройками изолируется от глобальной`, function () {

                    const projectFolderSettings = scopedConfigMap.get(folderKeys[0]!);
                    assert.equal(projectFolderSettings?.value, 'value-from-project-folder');
                });

            });

        });
    });
});
