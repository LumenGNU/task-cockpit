/** @file Cockpit/Workspace/index.ts */
/** @module Workspace */

import * as vscode from 'vscode';
import helpers from '../helpers';
import Tasks from './Tasks';
import type * as TC from '../types';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log, table } = Logger.get(module.filename);
// #endregion DEBUG


interface ScanResult {
    /** Список scope-записей (workspace file + folder_entries).
    * Workspace_file всегда первый, если есть */
    scopes: ReadonlyArray<TC.Scope>;
    /** Window-настройки (общие для всего workspace). */
    windowSettings: Readonly<TC.WindowSettings>;
    /** Resource-настройки, проиндексированные по fsPath файла задач. */
    resourceSettings: Readonly<TC.SettingsByFile>;
    /** Результат загрузки задач: карта задач по файлам и отчёт об отклонённых. */
    tasksFetchResult: Readonly<TC.FetchResult>;
}


const CONFIG_SECTION = "taskCockpit";


/** Модель рабочей области проекта.
 *
 * Отслеживает структуру workspace (папки, файлы задач), настройки расширения
 * и определения задач.
 * При изменении конфигурации (в т.ч. задач) или состава папок перестраивает внутреннее состояние
 * и уведомляет подписчиков через {@linkcode onDidChange}.
 *
 * */
export default class Workspace implements vscode.Disposable {

    private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();

    /** Срабатывает при изменении структуры workspace, настроек расширения
     * или определений задач.
     *
     * Сигнал о безусловной перестройки дерева. */
    public readonly onDidChange = this.onDidChangeEmitter.event;

    /** CTS текущего активного скана. Отменяется при запуске нового скана или при dispose. */
    private cts?: vscode.CancellationTokenSource;

    /** Составной Disposable для единого освобождения ресурсов экземпляра. */
    private readonly disposable: vscode.Disposable;

    /** Текущее состояние workspace. `undefined` — экземпляр не готов или disposed. */
    private scanResult?: ScanResult;


    /** Инициализирует новый экземпляр класса {@linkcode Workspace}.
     *
     * Автоматически подписывается на следующие события:
     * - {@linkcode vscode.workspace.onDidChangeConfiguration}
     * - {@linkcode vscode.workspace.onDidChangeWorkspaceFolders}
     *
     * При возникновении любого из вышеописанных событий экземпляр класса {@linkcode Workspace}
     * перестраивает свое внутреннее состояние и уведомляет всех подписчиков
     * через событие {@linkcode onDidChange}. */
    public constructor() {

        this.disposable = vscode.Disposable.from(
            vscode.workspace.onDidChangeConfiguration(this.configurationChange_Handler, this),
            vscode.workspace.onDidChangeWorkspaceFolders(this.workspaceFoldersChange_Handler, this),

            this.onDidChangeEmitter
        );

    }


    /** Освобождает все ресурсы, зарегистрированные при инициализации {@linkcode Workspace}. */
    public dispose(): void {

        this.disposable.dispose();

        if (this.cts) {
            this.cts.cancel();
            this.cts.dispose();
            this.cts = undefined;
        }

        this.scanResult = undefined;

        // #region DEBUG
        log(LogLevel.Debug, 'Disposed', 'dispose');
        // #endregion DEBUG
    }


    /** @throws {vscode.CancellationError} */
    public async reScan(): Promise<void> {

        // #region DEBUG
        log(LogLevel.Debug, 'Re-scan started ...', 'Re-scan');
        // #endregion DEBUG

        this.cts?.cancel();
        this.cts?.dispose();
        const cts = new vscode.CancellationTokenSource();
        this.cts = cts;

        try {
            this.scanResult = await Workspace.reScan(this.cts.token);
        }
        catch (error) {
            if (!(error instanceof vscode.CancellationError)) {
                vscode.window.showErrorMessage(`Internal error: Failed to re-scan workspace: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
            }

            // #region DEBUG
            log(LogLevel.Debug, 'Re-scan canceled, aborting', 'Re-scan');
            // #endregion DEBUG

            throw error;
        }
        finally {
            if (this.cts === cts) {
                this.cts = undefined;
            }
        }

        // #region DEBUG
        log(LogLevel.Debug, 'Re-scan done', 'Re-scan');
        // #endregion DEBUG
    }

    // #region Public


    /** Возвращает список scope-записей текущего workspace.
     *
     * Первым элементом (если есть) идёт workspace file,
     * за ним — записи для каждой папки workspace. */
    public getScopes(): ReadonlyArray<TC.Scope> {
        if (!this.scanResult) {
            throw new Error('Internal error: "Workspace" is not ready: not initialized or already disposed');
        }
        return this.scanResult.scopes;
    }


    /** Возвращает resource-настройки, проиндексированные по fsPath файла задач. */
    public getResourceSettings(): Readonly<TC.SettingsByFile> {
        if (!this.scanResult) {
            throw new Error('Internal error: "Workspace" is not ready: not initialized or already disposed');
        }
        return this.scanResult.resourceSettings;
    }


    /** Возвращает window-настройки (общие для всего workspace). */
    public getWindowSettings(): Readonly<TC.WindowSettings> {
        if (!this.scanResult) {
            throw new Error('Internal error: "Workspace" is not ready: not initialized or already disposed');
        }
        return this.scanResult.windowSettings;
    }


    /** Возвращает карту задач, проиндексированную по fsPath файла задач. */
    public getTasks(): Readonly<TC.TasksByFile> {
        if (!this.scanResult) {
            throw new Error('Internal error: "Workspace" is not ready: not initialized or already disposed');
        }
        return this.scanResult.tasksFetchResult.tasksByFile;
    }


    public getTask(taskId: TC.TaskID): vscode.Task | undefined {
        const { taskFile, taskName } = helpers.parseId(taskId);
        return this.getTasks().get(taskFile)?.get(taskName);
    }

    // #endregion Public


    // #region _Handlers


    /** Обработчик изменения состава папок workspace.
     *
     * Уведомляет подписчиков о изменении.
     *
     * Не изменяет состояние. */
    private workspaceFoldersChange_Handler(_e: vscode.WorkspaceFoldersChangeEvent) {

        // #region DEBUG
        log(LogLevel.Debug, 'Handler invoked', 'onDidChangeWorkspaceFolders');
        // #endregion DEBUG

        // #region DEBUG
        log(LogLevel.Debug, 'Firing onDidChange', 'onDidChangeWorkspaceFolders');
        // #endregion DEBUG

        this.onDidChangeEmitter.fire();
    }


    /** Обработчик изменения конфигурации.
     *
     * Реагирует на изменения в секциях `taskCockpit` и `tasks` и уведомляет подписчиков.
     *
     * Не изменяет внутреннее состояние. */
    private configurationChange_Handler(e: vscode.ConfigurationChangeEvent) {

        // #region DEBUG
        log(LogLevel.Debug, 'Handler invoked', 'onDidChangeConfiguration');
        // #endregion DEBUG

        const settingsChanged = e.affectsConfiguration(CONFIG_SECTION);
        const tasksChanged = e.affectsConfiguration('tasks');

        if (!settingsChanged && !tasksChanged) {

            // #region DEBUG
            log(LogLevel.Debug,
                `No relevant "${CONFIG_SECTION}" config or "tasks" changes, skipping`, 'onDidChangeConfiguration');
            // #endregion DEBUG

            return;
        }

        // #region DEBUG
        log(LogLevel.Debug, 'Firing onDidChange', 'onDidChangeConfiguration');
        // #endregion DEBUG

        this.onDidChangeEmitter.fire();
    }

    // #endregion _Handlers


    /** Перестраивает всё внутреннее состояние: scope-записи, resource- и window-настройки,
     * и карту задач.
     *
     * Вызывается при инициализации и при любом релевантном изменении.
     *
     * @throws {vscode.CancellationError} */
    private static async reScan(token: vscode.CancellationToken): Promise<ScanResult> {

        const scopes = Workspace.resolveScopes();
        const windowSettings = Workspace.resolveWindowSettings();
        const resourceSettings = Workspace.buildResourceSettingsMap(scopes);
        const tasksFetchResult = await Workspace.fetchTasks(scopes, token);

        return { scopes, windowSettings, resourceSettings, tasksFetchResult };
    }


    /** Формирует список scope-записей из текущего workspace.
     *
     * Workspace file (если есть) всегда первым, затем — папки.
     *
     * Для каждой папки URI указывает на `.vscode/tasks.json`, и не обязательно
     * существуют физически на диске. */
    private static resolveScopes(): ReadonlyArray<TC.Scope> {

        const scopes = [
            // если есть всегда первым
            vscode.workspace.workspaceFile ? { name: vscode.workspace.name ?? '<unnamed>', uri: vscode.workspace.workspaceFile } : undefined,
            ...(
                vscode.workspace.workspaceFolders
                    ?.map(folder => ({ name: folder.name, uri: vscode.Uri.joinPath(folder.uri, ".vscode", "tasks.json") })) ?? []
            )]
            .filter((scope): scope is TC.Scope => scope !== undefined);

        // #region DEBUG
        log(LogLevel.Debug, 'Workspace scopes:');
        table(LogLevel.Debug, scopes.map(e => ({ Name: e.name, FsPath: e.uri.fsPath })));
        // #endregion DEBUG

        return scopes;
    }


    /** Строит `Map<File, ResourceSettings>` для всех scope-записей. */
    private static buildResourceSettingsMap(scopes: ReadonlyArray<TC.Scope>): Readonly<TC.SettingsByFile> {

        const resourceSettings = new Map(scopes.map(scope => [scope.uri.fsPath, Workspace.readResourceSettings(scope)]));

        // #region DEBUG

        log(LogLevel.Debug, 'Resource settings:');
        const flatByScope = scopes
            // .filter(e => resourceSettings.has(e.uri.fsPath))
            .map(e => {
                const rs = resourceSettings.get(e.uri.fsPath)!;
                return [e.name, {
                    segmentSeparator: rs.branchConfig.segmentSeparator,
                    useGroupKind: rs.branchConfig.useGroupKind,
                    showHidden: rs.branchConfig.showHidden,
                    useFolderIcon: rs.nodeConfig.useFolderIcon,
                    defaultIconName: rs.nodeConfig.defaultIconName,
                    tintLabel: rs.nodeConfig.tintLabel
                }] as const;
            });
        if (flatByScope.length > 0) {
            const keys = Object.keys(flatByScope[0][1]) as Array<keyof typeof flatByScope[0][1]>;
            table(LogLevel.Debug, keys.map(key => {
                const row: Record<string, unknown> = { Setting: key };
                for (const [name, flat] of flatByScope) {
                    row[name] = flat[key];
                }
                return row;
            }));
        }
        // #endregion DEBUG

        return resourceSettings;
    }


    /** Читает настройки `taskCockpit.display.*` и `taskCockpit.filtering.*`
     * для указанного scope */
    private static readResourceSettings(scope: TC.Scope): Readonly<TC.ScopedSettings> {

        const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION, scope.uri);

        return {
            branchConfig: {
                segmentSeparator: configuration.get<string>('display.segmentSeparator') || false as const,
                showHidden: configuration.get<boolean>('filtering.showHidden', false),
                useGroupKind: configuration.get<boolean>('display.useGroupKind', false)
            },
            nodeConfig: {
                defaultIconName: configuration.get<string>('display.defaultIconName', 'tools'),
                tintLabel: configuration.get<boolean>('display.tintLabel', false),
                useFolderIcon: configuration.get<boolean>('display.useFolderIcon', false)
            }
        };
    }


    /** Читает настройки `taskCockpit.filtering.*` и `taskCockpit.validation.*`
     * уровня окна (без привязки к scope). */
    private static resolveWindowSettings(): Readonly<TC.WindowSettings> {

        const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION);

        const windowSettings = {
            excludeFolders: configuration.get<string[]>('filtering.excludeFolders', []),
            // @fixme: package.json, change log, etc
            // @reject excludeWorkspaceTasks: configuration.get<boolean>('filtering.excludeWorkspaceTasks', false),
            // @reject validationSettings: { // @fixme: это не должно быть тут, это не относится к условию
            //     // "безусловной перестройки дерева"
            //     dependencies: configuration.get<boolean>('validation.dependencies', false),
            //     duplicateLabels: configuration.get<boolean>('validation.duplicateLabels', false)
            // }
        };

        // #region DEBUG

        log(LogLevel.Debug, 'Window settings:');
        table(LogLevel.Debug, windowSettings, { headers: ['Setting', 'Value'] });

        // #endregion DEBUG

        return windowSettings;
    }


    /** Загружает задачи для всех scope-записей.
     *
     * @throws {vscode.CancellationError} */
    private static async fetchTasks(scopes: ReadonlyArray<TC.Scope>, token: vscode.CancellationToken): Promise<Readonly<TC.FetchResult>> {

        const fetchResult = await Tasks.fetch(scopes, token);

        // #region DEBUG
        log(LogLevel.Debug, 'Tasks fetched summary:');
        const { tasksByFile, rejectReport } = fetchResult;
        table(LogLevel.Debug,
            [...tasksByFile.entries()].map(([f, m]) => ({
                File: f,
                ['UserTask(s)']: m.size,
                Rejected: rejectReport.get(f) || undefined
            })),
            { undefinedAsEmpty: true }
        );
        // #endregion DEBUG

        return fetchResult;
    }

}
