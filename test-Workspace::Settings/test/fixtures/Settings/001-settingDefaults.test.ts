import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import Settings from '../../../src/Workspace/Settings';

import { deepPlain } from './deepPlain';


const EMPTY_SECTION = 'EMPTY_SETTINGS';

let folderScope: vscode.WorkspaceFolder;


// `${/*N=0*/'000'/**/}`

suite('Settings', function () {

    suiteSetup(function () {

        assert.equal(vscode.workspace.name, 'Settings (Workspace)',
            `pre: неожиданное имя рабочей области: "${vscode.workspace.name}"`);

        assert.ok(vscode.workspace.workspaceFolders);
        const _folderScope = vscode.workspace.workspaceFolders.at(0);
        assert.ok(_folderScope);

        folderScope = _folderScope;

        assert.ok(folderScope,
            'pre: workspaceFolders пуст или не определён');

    });

    suite('(Проект без конфигурации)', function () {

        suiteSetup(function () {
            const workspaceConfiguration = vscode.workspace.getConfiguration(undefined);
            const scopeConfiguration = vscode.workspace.getConfiguration(undefined, folderScope);

            assert.ok(Object.keys(workspaceConfiguration.get(EMPTY_SECTION)!).length === 0, 'pre: workspaceConfiguration уже содержит данные секции');
            assert.ok(Object.keys(scopeConfiguration.get(EMPTY_SECTION)!).length === 0, 'pre: scopeConfiguration уже содержит данные секции');
        });

        suite('Общие настройки', function () {

            test(`${/*++N*/'001'/**/} все общие настройки — значения по умолчанию`, function () {

                const workspaceSettings = Settings.Workspace.init(EMPTY_SECTION).get();

                assert.deepEqual(deepPlain(workspaceSettings), {
                    filtering: {
                        excludeFolders: new Set(),
                    },
                    pinned: {
                        visibility: true,
                        pathCompression: true,
                    },
                    validation: {
                        dependencies: false,
                        duplicates: true,
                    },
                    runtime: {
                        monitor: {
                            polling: {
                                min: 322,
                                cap: 550,
                                acceleration: 0.2,
                            },
                        },
                        terminals: {
                            timeout: 1300,
                        },
                    },
                }, 'значения по умолчанию не совпадают');

            });
        });

        suite('Scopes настройки', function () {

            test(`${/*++N*/'002'/**/} настройки для workspace области — значения по умолчанию`, function () {

                const workspaceSettings = Settings.Scope.init(EMPTY_SECTION).get(vscode.TaskScope.Workspace);

                assert.deepEqual(deepPlain(workspaceSettings), {
                    nodeConfig: {
                        defaultIconName: 'tools',
                        tintLabel: false,
                        useFolderIcon: false,
                    },
                    treeConfig: {
                        segmentSeparator: '',
                        showHidden: false,
                        useGroupKind: false,
                    },
                }, 'значения по умолчанию не совпадают');

            });


            test(`${/*++N*/'003'/**/} настройки для folder области — значения по умолчанию`, function () {

                const folderSettings = Settings.Scope.init(EMPTY_SECTION).get(folderScope);

                assert.deepEqual(deepPlain(folderSettings), {
                    nodeConfig: {
                        defaultIconName: 'tools',
                        tintLabel: false,
                        useFolderIcon: false,
                    },
                    treeConfig: {
                        segmentSeparator: '',
                        showHidden: false,
                        useGroupKind: false,
                    },
                }, 'значения по умолчанию не совпадают');
            });
        });
    });
});
