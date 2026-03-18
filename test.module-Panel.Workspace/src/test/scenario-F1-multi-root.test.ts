import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Workspace from '../Workspace';
import * as tHelpers from './test-helpers';
import type TC from '../types';



suite('@module MainPanel.Workspace', () => {

    const folderNames = ['folder-a', 'folder-b', 'folder-c'] as const;
    const fixturesDir = vscode.Uri.joinPath(vscode.workspace.workspaceFile!, '../../test-fixtures');
    const folders = folderNames.map(name => ({
        name,
        uri: vscode.Uri.joinPath(fixturesDir, name)
    }));

    suiteSetup(async () => {

        assert.ok(
            vscode.workspace.workspaceFile,
            'Expected multi-root workspace (workspaceFile is undefined)'
        );

        assert.strictEqual(
            vscode.workspace.name,
            'multi-root (Workspace)',
            'Unexpected workspace name'
        );

        assert.ok(
            vscode.workspace.workspaceFolders,
            'Expected workspaceFolders'
        );


        for (const folder of folders) {
            await vscode.workspace.fs.stat(folder.uri);
        }

        await tHelpers.suiteSetup_clearFixture();

    });

    // Целостность scopes при мутациях workspace:
    // clear → restore → reorder → rename
    suite('Scenario F1', () => {

        let ws: Workspace;
        let workspaceScope: TC.Scope;
        let foldersScopes: ReadonlyMap<typeof folderNames[number], TC.Scope>;

        setup(async () => {
            await tHelpers.suiteSetup_setupFixture(folders);
            ws = await tHelpers.createWorkspaceObject();

            workspaceScope = tHelpers.resolveWorkspaceScope(ws);
            foldersScopes = tHelpers.resolveFoldersScopes(ws, folderNames);
        });

        teardown(async () => {
            await tHelpers.suiteSetup_clearFixture();
            ws.dispose();
            ws = undefined as never;
        });

        suite('Initial state', () => {

            test('all scopes present: workspace file + folders', () => {

                const scopes = ws.getScopes();

                const workspaceScope = scopes.at(0);
                assert.ok(workspaceScope);

                const folderScopes = scopes.slice(1);

                assert.strictEqual(folderScopes.length, folderNames.length);

            });


            test('workspace file scope is first', () => {

                const scopes = ws.getScopes();

                assert.ok(
                    scopes.at(0)!.uri.fsPath.endsWith('.code-workspace'),
                    'First scope should be workspace file'
                );
            });


            test('folder scopes point to tasks.json', () => {

                const scopes = ws.getScopes();
                const foldersOnly = scopes.slice(1);

                assert.ok(foldersOnly.length > 0);

                for (const scope of foldersOnly) {
                    assert.ok(
                        scope.uri.fsPath.endsWith('tasks.json'),
                        `Expected tasks.json URI, got: ${scope.uri.fsPath}`
                    );
                }
            });


            test('folder names match workspace definition order', () => {

                const scopes = ws.getScopes();
                const names = scopes.slice(1).map(s => s.name);

                assert.deepStrictEqual(names, folderNames);
            });


            test('resourceSettings available for all scopes', () => {

                const scopes = ws.getScopes();

                assert.ok(scopes.length > 0);

                for (const scope of scopes) {
                    assert.ok(
                        tHelpers.getScopedSettings(ws, scope),
                        `Missing resourceSettings for "${scope.name}"`
                    );
                }
            });


            test('resourceSettings undefined for unknown path', () => {
                assert.strictEqual(
                    ws.getResourceSettings().get('/nonexistent/path' as any),
                    undefined
                );
            });

        });


        suite('Mutations', () => {

            // Удаление всех папок → остаётся только scope workspace file
            test('remove all folders: only workspace file scope remains', async () => {

                assert.strictEqual(foldersScopes.size, folderNames.length, 'Precondition: all folders present before clear');

                await tHelpers.mutateFixtureAndAwaitChange(ws, []);

                const scopes = tHelpers.resolveFoldersScopes(ws, folderNames);
                assert.strictEqual(scopes.size, 0, 'Only workspace file scope should remain');
                assert.ok(tHelpers.resolveWorkspaceScope(ws), 'Only workspace file scope should remain');
            });


            // Удаление всех папок → resourceSettings бывших папок становятся undefined
            test('remove all folders: former resourceSettings become undefined', async () => {

                assert.ok(foldersScopes.size > 0);

                for (const scope of foldersScopes.values()) {
                    assert.ok(tHelpers.getScopedSettings(ws, scope), `Precondition: resourceSettings should exist before clear`);
                }

                await tHelpers.mutateFixtureAndAwaitChange(ws, []);

                const newFoldersScopes = tHelpers.resolveFoldersScopes(ws, folderNames);

                assert.ok(newFoldersScopes.size === 0);

                for (const scope of foldersScopes.values()) {
                    assert.throws(
                        () => tHelpers.getScopedSettings(ws, scope),
                        /Settings for scope ".+" not found/
                    );
                }
            });


            // clear → restore: scopes и resourceSettings полностью восстанавливаются
            test('restore folders: scopes and resourceSettings recovered', async () => {

                assert.strictEqual(foldersScopes.size, folderNames.length, 'Precondition: all folders present before clear');


                for (const scope of foldersScopes.values()) {
                    assert.ok(tHelpers.getScopedSettings(ws, scope));
                }

                await tHelpers.mutateFixtureAndAwaitChange(ws, []);

                assert.strictEqual(tHelpers.resolveFoldersScopes(ws, folderNames).size, 0, 'Precondition: only workspace file scope after clear');


                await tHelpers.mutateFixtureAndAwaitChange(ws, folders);


                for (const scope of foldersScopes.values()) {
                    assert.ok(
                        tHelpers.getScopedSettings(ws, scope),
                        `resourceSettings should be available for "${scope.name}"`
                    );
                }

            });


            // Реверс порядка папок → workspace file scope остаётся первым
            test('reorder folders: workspace file scope remains first', async () => {

                const reversed = [...folders].reverse();

                await tHelpers.mutateFixtureAndAwaitChange(ws, reversed);

                assert.ok(
                    tHelpers.resolveWorkspaceScope(ws),
                    'Workspace file should remain the first scope regardless of folder order'
                );
            });


            // Реверс порядка папок → scopes отражают новый порядок
            test('reorder folders: scopes reflect new order', async () => {

                const reversed = [...folders].reverse();

                assert.ok(reversed.length >= 2);

                await tHelpers.mutateFixtureAndAwaitChange(ws, reversed);

                const newScopes = [...tHelpers.resolveFoldersScopes(ws, reversed).values()];

                assert.deepStrictEqual(
                    newScopes,
                    reversed,
                    'Folder order should reflect the new arrangement'
                );
            });


            // // Переименование папки → name обновился, uri остался прежним
            // test('rename folder: name updated, uri unchanged', async () => {

            //     const index = 2;
            //     const newName = 'NEW_NAME';

            //     const origScopes = ws.getScopes();

            //     const renamedScopes = origScopes.map(s => s.name);
            //     renamedScopes[index] = newName;

            //     await tHelpers.mutateFixtureAndAwaitChange(ws, renamedScopes);

            //     assert.strictEqual(ws.getScopes()[index].name, newName, 'Renamed scope should exist');
            //     assert.strictEqual(ws.getScopes()[index].uri.fsPath, origUri, 'fsPath (and resourceSettings key) should remain the same after rename');
            // });

        });

    });

});