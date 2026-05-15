import * as assert from 'assert/strict';
import * as vscode from 'vscode';

import Settings from '../../../src/Workspace/Settings';
import { deepPlain } from './deepPlain';


const CONFIGURED_SECTION = 'CONFIGURED_SETTINGS';
const CONFIGURED_WRONG_SECTION = 'CONFIGURED_WRONG_SETTINGS';

let folderScope: vscode.WorkspaceFolder;


// `${/*N=0*/'000'/**/}` 

suite('Settings', function () {


    suiteSetup(function () {

        assert.equal(vscode.workspace.name, 'Settings (Workspace)',
            `pre: неожиданное имя рабочей области: "${vscode.workspace.name}"`);

        const _folderScope = vscode.workspace.workspaceFolders?.at(0);

        assert.ok(_folderScope,
            'pre: workspaceFolders пуст или не определён');

        folderScope = _folderScope;

    });

    suite('(Проект с конфигурацией)', function () {

        suiteSetup(function () {
            const workspaceConfiguration = vscode.workspace.getConfiguration(undefined);
            const scopeConfiguration = vscode.workspace.getConfiguration(undefined, folderScope);

            assert.ok(Object.keys(workspaceConfiguration.get(CONFIGURED_SECTION)!).length !== 0, 'pre: workspaceConfiguration не содержит данные секции');
            assert.ok(Object.keys(scopeConfiguration.get(CONFIGURED_SECTION)!).length !== 0, 'pre: scopeConfiguration не содержит данные секции');

        });

        suite('Общие настройки', function () {

            test(`${/*++N*/'001'/**/} все общие настройки — значения из конфигурации`, function () {

                const workspaceSettings = Settings.Workspace.init(CONFIGURED_SECTION).get();

                assert.deepEqual(deepPlain(workspaceSettings), {
                    filtering: {
                        excludeFolders: new Set(['a', 'b', 'c']),
                    },
                    pinned: {
                        visibility: false,
                        pathCompression: false,
                    },
                    validation: {
                        dependencies: true,
                        duplicates: false,
                    },
                    runtime: {
                        monitor: {
                            polling: {
                                min: 232,
                                cap: 505,
                                acceleration: 0.3,
                            },
                        },
                        terminals: {
                            timeout: 2220
                        },
                    },
                }, 'значения из code-workspace не совпадают');

            });

            suite('Дополнительная валидация', function () {

                suiteSetup(function () {
                    const workspaceConfiguration = vscode.workspace.getConfiguration(undefined);
                    const raw = workspaceConfiguration.get<unknown>(CONFIGURED_WRONG_SECTION);
                    assert.ok(raw);
                    assert.ok(typeof raw === 'object');

                    assert.ok('runtime' in raw);
                    assert.ok(raw.runtime);
                    assert.ok(typeof raw.runtime === 'object');

                    assert.ok('monitor' in raw.runtime);
                    assert.ok(raw.runtime.monitor);
                    assert.ok(typeof raw.runtime.monitor === 'object');

                    assert.ok('polling' in raw.runtime.monitor);
                    assert.ok(raw.runtime.monitor.polling);
                    assert.ok(typeof raw.runtime.monitor.polling === 'object');

                    assert.ok('min' in raw.runtime.monitor.polling);
                    assert.ok(typeof raw.runtime.monitor.polling.min === 'number');

                    assert.ok('cap' in raw.runtime.monitor.polling);
                    assert.ok(typeof raw.runtime.monitor.polling.min === 'number');

                    assert.equal(raw.runtime.monitor.polling.min, raw.runtime.monitor.polling.cap, 'pre: runtime.monitor.polling.min и runtime.monitor.polling.cap не имеют одинаковое значение');

                });

                test(`${/*++N*/'002'/**/} polling.cap >= (polling.min * 1.7)`, function () {

                    const workspaceSettings = Settings.Workspace.init(CONFIGURED_WRONG_SECTION).get();

                    const { cap, min } = workspaceSettings.runtime.monitor.polling;

                    assert.ok(cap >= min * 1.7, 'cap всегда должен быть больше min');

                });

            });

        });

        suite('Scopes настройки', function () {

            test(`${/*++N*/'003'/**/} настройки для workspace области — значения из конфигурации`, function () {

                const workspaceSettings = Settings.Scope.init(CONFIGURED_SECTION).get(vscode.TaskScope.Workspace);


                assert.deepEqual(deepPlain(workspaceSettings), {
                    nodeConfig: {
                        defaultIconName: 'paz',
                        tintLabel: true,
                        useFolderIcon: true,
                    },
                    treeConfig: {
                        segmentSeparator: '\\',
                        showHidden: true,
                        useGroupKind: true,
                    }
                }, 'значения из code-workspace не совпадают');

            });

            test(`${/*++N*/'004'/**/} настройки для folder области — значения из конфигурации`, function () {

                const folderSettings = Settings.Scope.init(CONFIGURED_SECTION).get(folderScope);

                assert.deepEqual(deepPlain(folderSettings), {
                    nodeConfig: {
                        defaultIconName: 'zap',
                        tintLabel: true,
                        useFolderIcon: true
                    },
                    treeConfig: {
                        segmentSeparator: '/',
                        showHidden: true,
                        useGroupKind: true,
                    }
                }, 'значения из settings.json не совпадают');

            });

        });

    });
});
