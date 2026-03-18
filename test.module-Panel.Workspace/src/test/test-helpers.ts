import * as vscode from 'vscode';
import Workspace from '../Workspace';
import TC from '../types';


// #region Манипуляция папками workspace (только для multi-root workspace)

// Программное изменение структуры multi-root фикстуры: 
// добавление, удаление, переупорядочивание, переименование папок. 
// Все работают через updateWorkspaceFolders + event-driven подтверждение.

/** Удаляет все папки из workspace.
 * Если папок нет — возвращается немедленно. */
export async function suiteSetup_clearFixture(): Promise<void> {

    if (vscode.workspace.workspaceFile === undefined) {
        throw new Error('In no multi-root workspace');
    }

    if (!vscode.workspace.workspaceFolders) {
        throw new Error('Expected workspaceFolders');
    }

    if (vscode.workspace.workspaceFolders.length === 0) {
        return;
    }

    await _setupFixture([]);
    return;
}


export async function suiteSetup_setupFixture(folders: ReadonlyArray<{ readonly name: string, readonly uri: vscode.Uri; }>): Promise<void> {

    if (vscode.workspace.workspaceFile === undefined) {
        throw new Error('In no multi-root workspace');
    }

    if (!vscode.workspace.workspaceFolders) {
        throw new Error('Expected workspaceFolders');
    }

    const currentFolders = JSON.stringify(vscode.workspace.workspaceFolders!.map(f => ({ name: f.name, uri: f.uri })), _replacer);
    const expectedFolders = JSON.stringify(folders, _replacer);

    if (currentFolders === expectedFolders) {
        return;
    }

    await _setupFixture(folders);
    return;
}


function _replacer(this: any, key: string, value: any) {
    if (key === 'uri') {
        return value.path;
    }
    return value;
}



/** Добавляет папки в workspace. (folder-a, folder-b, folder-c)*/
function _setupFixture(folders: ReadonlyArray<{ readonly name: string, readonly uri: vscode.Uri; }>): Promise<void> {

    return new Promise<void>((resolve, reject) => {

        const expectedFolders = JSON.stringify(folders, _replacer);
        const currentFolders = JSON.stringify(vscode.workspace.workspaceFolders!.map(f => ({ name: f.name, uri: f.uri })), _replacer);

        const handler = vscode.workspace.onDidChangeWorkspaceFolders(() => {
            handler.dispose();

            const currentFolders = JSON.stringify(vscode.workspace.workspaceFolders!.map(f => ({ name: f.name, uri: f.uri })), _replacer);

            if (currentFolders === expectedFolders) {
                resolve();
            } else {
                reject(new Error(`Expected folders [${expectedFolders}], got [${currentFolders}]`));
            }
        });

        // Note: it is not valid to call updateWorkspaceFolders() multiple times without waiting for the onDidChangeWorkspaceFolders() to fire.
        const result = vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders!.length, ...folders);
        if (!result) {
            handler.dispose();
            reject(new Error(`updateWorkspaceFolders fail in setupFixture: [${currentFolders}] --> [${expectedFolders}]`));
        }
    });
}



// /** Переименовывает папку в workspace.
//  *
//  * @param index 1-based индекс папки.
//  * @param newName Новое имя. */
// export function mutator_renameFixture(index: number, newName: string): Promise<void> {

//     if (vscode.workspace.workspaceFile === undefined) {
//         return Promise.reject(new Error('In no multi-root workspace'));
//     }

//     if (!vscode.workspace.workspaceFolders) {
//         return Promise.reject(new Error('Expected workspaceFolders'));
//     }

//     if (index < 1) {
//         return Promise.reject(new RangeError('Index must be 1-based'));
//     }

//     if (index > vscode.workspace.workspaceFolders.length) {
//         return Promise.reject(new RangeError(`Index must be <= ${vscode.workspace.workspaceFolders.length}`));
//     }

//     return new Promise<void>((resolve, reject) => {
//         const folderIndex = index - 1;
//         const folder = vscode.workspace.workspaceFolders!.at(folderIndex)!;
//         const handler = vscode.workspace.onDidChangeWorkspaceFolders(() => {
//             handler.dispose();
//             const current = vscode.workspace.workspaceFolders!.at(folderIndex)!;
//             if (current.name !== newName) {
//                 reject(new Error(`Expected folder name "${newName}", got "${current.name}"`));
//             } else {
//                 resolve();
//             }
//         });
//         const result = vscode.workspace.updateWorkspaceFolders(folderIndex, 1, { ...folder, name: newName });
//         if (!result) {
//             handler.dispose();
//             reject(new Error('updateWorkspaceFolders fail in renameFixture'));
//         }
//     });
// }

// #endregion


// #region Управление настройками

// Мутация settings на разных уровнях 
// (folder/workspace) с синхронизацией через Workspace.onDidChange.


/** Сбрасывает все resource-scoped настройки taskCockpit
 * на уровне workspace и каждой папки, если в multi-root и присутствуют. */
export async function resetSettings(section: string, resourceSettingKeys: string[]): Promise<void> {

    const config = vscode.workspace.getConfiguration(section);
    for (const key of resourceSettingKeys) {
        await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
    }

    if (vscode.workspace.workspaceFile === undefined || vscode.workspace.workspaceFolders === undefined) {
        return;
    }

    for (const folder of vscode.workspace.workspaceFolders) {
        const config = vscode.workspace.getConfiguration(section, folder.uri);
        for (const key of resourceSettingKeys) {
            await config.update(key, undefined, vscode.ConfigurationTarget.WorkspaceFolder);
        }
    }
}


/** Обновляет resource-scoped настройку на уровне папки
 * и ждёт {@linkcode Workspace.onDidChange}. */
export async function updateResourceSetting(
    ws: Workspace,
    scope: TC.Scope,
    section: string,
    key: string,
    value: unknown
): Promise<void> {

    if (vscode.workspace.workspaceFile === undefined) {
        throw new Error('In no multi-root workspace');
    }

    const config = vscode.workspace.getConfiguration(section, scope.uri);
    const changed = _awaitWsChange(ws);
    await config.update(key, value, vscode.ConfigurationTarget.WorkspaceFolder);
    await changed;
}


/** Обновляет resource-scoped настройку на уровне workspace
 * и ждёт {@linkcode Workspace.onDidChange}. */
export async function updateWorkspaceSetting(
    ws: Workspace,
    section: string,
    key: string,
    value: unknown
): Promise<void> {
    const config = vscode.workspace.getConfiguration(section);
    const changed = _awaitWsChange(ws);
    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    await changed;
}

// #endregion


// #region I/O фалов задач

// Запись и очистка задач для single-folder фикстуры. 
// writeTasksFile — low-level (ожидает onDidChangeConfiguration('tasks')), остальные — обёртки.


/** Читает и парсит .code-workspace файл.
 * Возвращает объект с секциями (folders, tasks, settings, ...). */
async function _readWorkspaceConfig(): Promise<Record<string, unknown>> {

    if (vscode.workspace.workspaceFile === undefined) {
        throw new Error('In no multi-root workspace');
    }

    const raw = new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.workspace.workspaceFile));

    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed !== 'object') {
        throw new Error(`Invalid workspace config: ${raw}`);
    }

    return parsed;
}


/** Записывает содержимое в файл задач и ждёт, пока VS Code обработает изменение
 * конфигурации `tasks`.
 *
 * Таймаут — защита от записей, не меняющих состояние VS Code (повторная очистка). */
async function _writeTasksFile(tasksFileUri: TC.Uri, content: string): Promise<void> {

    try {
        await vscode.workspace.fs.stat(tasksFileUri);
    }
    catch (e) {
        throw new Error(`Fixture does not contain ${tasksFileUri.fsPath}`);
    }

    const settled = new Promise<void>((resolve, reject) => {

        const timeout = setTimeout(() => {
            handler.dispose();
            reject(new Error(`writeTasksFile: onDidChangeConfiguration('tasks') not received within timeout. Possible no-op write. Content: ${content}`));
        }, 2500);

        const handler = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('tasks', tasksFileUri)) {
                clearTimeout(timeout);
                handler.dispose();
                resolve();
            }
        });
    });

    await vscode.workspace.fs.writeFile(tasksFileUri, new TextEncoder().encode(content));

    await settled;
}


async function _tasksExist(tasksFileUri: TC.Uri): Promise<boolean> {

    const raw = new TextDecoder().decode(await vscode.workspace.fs.readFile(tasksFileUri));
    const parsed = JSON.parse(raw);
    const tasksObj = (tasksFileUri.fsPath.endsWith('.json')) ? parsed.tasks : parsed.tasks?.tasks;
    if (Array.isArray(tasksObj) && tasksObj.length > 0) {
        return true;
    }
    return false;
}


/** Записывает массив задач в файл задач как `{ version: "2.0.0", tasks }`. */
async function _writeTasks(tasksFileUri: TC.Uri, tasks: object[]): Promise<void> {

    if (tasksFileUri.fsPath.endsWith('.json')) {
        return await _writeTasksFile(tasksFileUri, JSON.stringify({ version: "2.0.0", tasks }));
    }
    else {
        const wsCodeContent = await _readWorkspaceConfig();
        wsCodeContent.tasks = { version: "2.0.0", tasks };
        return await _writeTasksFile(tasksFileUri, JSON.stringify(wsCodeContent));
    }

}



// #endregion


// #region Синхронизация с моделью Workspace

// Ожидание Workspace.onDidChange после мутаций. awaitChange — примитив; 
// остальные — compound-хелперы «подписка → мутация → ожидание», 
// типизированные под конкретный вид мутации.

/** Ждёт следующего события {@linkcode Workspace.onDidChange}.
 * Реджектится по таймауту (по умолчанию 2500мс). */
function _awaitWsChange(ws: Workspace, ms: number = 2500): Promise<void> {

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            handler.dispose();
            reject(new Error(`_awaitWsChange: onDidChange not fired within ${ms}ms`));
        }, ms);

        const handler = ws.onDidChange(() => {

            // поступление ws.onDidChange означает что нужно запустить ws.reScan().
            // каждый новый вызов ws.reScan() отменяет предыдущий ws.reScan().
            // ws.reScan() должен доработать до конца чтобы ws была
            // в правильном состоянии.
            ws.reScan()
                .then(() => {
                    clearTimeout(timeout);
                    handler.dispose();
                    resolve();
                })
                .catch((err) => {
                    if (!(err instanceof vscode.CancellationError)) {
                        clearTimeout(timeout);
                        handler.dispose();
                        reject(err);
                    }
                });
        });
    });

}


/** Выполняет мутацию фикстуры и ждёт {@linkcode Workspace.onDidChange}.
 * Паттерн: подписка → мутация → ожидание. */
export async function mutateFixtureAndAwaitChange(ws: Workspace, folders: ReadonlyArray<{ readonly name: string, readonly uri: vscode.Uri; }>): Promise<void> {

    if (vscode.workspace.workspaceFile === undefined) {
        return Promise.reject(new Error('In no multi-root workspace'));
    }

    if (!vscode.workspace.workspaceFolders) {
        return Promise.reject(new Error('Expected workspaceFolders'));
    }

    const currentFolders = JSON.stringify(vscode.workspace.workspaceFolders!.map(f => ({ name: f.name, uri: f.uri })));
    const expectedFolders = JSON.stringify(folders);

    if (currentFolders === expectedFolders) {
        return Promise.reject(new Error(`No-op in mutateFixtureAndAwaitChange: [${currentFolders}] --> [${expectedFolders}]`));
    }

    const changed = _awaitWsChange(ws);
    await _setupFixture(folders);
    await changed;
}


/** Записывает задачи в tasks.json и ждёт {@linkcode Workspace.onDidChange}.
 * Паттерн: подписка → мутация → ожидание. */
export async function writeTasksAndAwaitChange(ws: Workspace, scope: TC.Scope, tasks: object[]): Promise<void> {
    const changed = _awaitWsChange(ws);
    await _writeTasks(scope.uri, tasks);
    await changed;
}


// внимательно, разрешается только если перезаписывает корректный tasks.json,
// или если корректными данными
export async function writeAnyAndAwaitChange(ws: Workspace, scope: TC.Scope, content: string): Promise<void> {
    const changed = _awaitWsChange(ws);
    await _writeTasksFile(scope.uri, content);
    await changed;
}



/** Очищает файл задач (пустой объект).
 *
 * Если задач уже нет — возвращается немедленно,
 * чтобы избежать зависания при повторной очистке в teardown. */
export async function clearTasksAndAwaitChange(ws: Workspace, scope: TC.Scope): Promise<void> {

    if (!await _tasksExist(scope.uri)) {
        return;
    }

    const changed = _awaitWsChange(ws);
    await _writeTasks(scope.uri, []);
    await changed;
}


// #endregion



// #region Жизненный цикл теста

// Setup-фаза: создание стабилизированного экземпляра Workspace и precondition-проверка 
// через запись baseline-задачи.



export async function createWorkspaceObject(): Promise<Workspace> {
    const workspace = new Workspace();

    let iterations = 0;
    let dirty = false;

    const listener = workspace.onDidChange(() => { dirty = true; });

    do {
        dirty = false;
        await workspace.reScan();
        if (++iterations > 10) {
            throw new Error('Workspace did not stabilize');
        }
    } while (dirty);


    listener.dispose();

    return workspace;
}

// #endregion


export function resolveWorkspaceScope(ws: Workspace): Readonly<TC.Scope> {

    const scope = ws.getScopes().at(0);

    if (!scope) {
        throw new Error('No workspace scope in workspace');
    }

    const tasksFile = scope.uri.fsPath;

    if (vscode.workspace.workspaceFile !== undefined) {
        if (!tasksFile.endsWith('.code-workspace')) {
            throw new Error('Workspace file is not a .code-workspace in multi-root workspace');
        }
    }

    return scope;
}



export function resolveFoldersScopes<T>(ws: Workspace, folderNames: readonly T[]): ReadonlyMap<typeof folderNames[number], Readonly<TC.Scope>> {

    if (vscode.workspace.workspaceFile === undefined) {
        throw new Error('In no multi-root workspace');
    }

    return new Map(
        folderNames.map(name => {
            const scope = ws.getScopes().find((value: TC.Scope, index: number) => {
                return (value.name === name) && index !== 0;
            });
            if (!scope) {
                return null;
            }
            return [name, scope];
        })
            .filter((v): v is [typeof folderNames[number], Readonly<TC.Scope>] => v !== null)
    );
}


export function getScopedTask(ws: Workspace, scope: TC.Scope): TC.ScopedTasks {

    const tasks = ws.getTasks().get(scope.uri.fsPath);

    if (!tasks) {
        throw new Error(`Tasks for scope "${scope.name}" not found`);
    }

    return tasks;
}


export function getScopedSettings(ws: Workspace, scope: TC.Scope) {
    const scopedSettings = ws.getResourceSettings().get(scope.uri.fsPath);

    if (!scopedSettings) {
        throw new Error(`Settings for scope "${scope.name}" not found`);
    }

    return scopedSettings;
}