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


interface ScanResult { tasksByFile: TC.TasksByFile, treeInput: TC.TreeInput; }


const CONFIG_SECTION = "taskCockpit";


/** Модель рабочей области проекта.
 *
 * Отслеживает структуру workspace (папки, файлы задач), настройки расширения
 * и определения задач.
 *
 * При изменении конфигурации (в т.ч. задач) или состава папок **уведомляет** подписчиков
 * через {@linkcode onDidChange}. Само перестроение состояния происходит только при
 * явном вызове {@linkcode reScan}.
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
    private cts: vscode.CancellationTokenSource | null = null;

    /** Составной Disposable для единого освобождения ресурсов экземпляра. */
    private readonly disposable: vscode.Disposable;

    /** Текущее состояние workspace. `null` — экземпляр не готов или disposed. */
    private scanResult: ScanResult | null = null;


    /** Инициализирует новый экземпляр класса {@linkcode Workspace}.
     *
     * Автоматически подписывается на следующие события:
     * - {@linkcode vscode.workspace.onDidChangeConfiguration}
     * - {@linkcode vscode.workspace.onDidChangeWorkspaceFolders}
     *
     * При возникновении событий **не перестраивает** состояние самостоятельно —
     * только уведомляет подписчиков через {@linkcode onDidChange}.
     * Перестройка происходит при вызове {@linkcode reScan}. */
    private constructor() {

        this.disposable = vscode.Disposable.from(
            vscode.workspace.onDidChangeConfiguration(this.configurationChange_Handler, this),
            vscode.workspace.onDidChangeWorkspaceFolders(this.workspaceFoldersChange_Handler, this),

            this.onDidChangeEmitter
        );

    }


    public static async init(): Workspace {

        const workspace = new Workspace();

        let dirty = false;

        const listener = workspace.onDidChange(() => { dirty = true; });

        do {
            dirty = false;
            await workspace.reScan();
        } while (dirty);


        listener.dispose();

    }


    /** Освобождает все ресурсы, зарегистрированные при инициализации {@linkcode Workspace}. */
    public dispose(): void {

        this.disposable.dispose();

        if (this.cts) {
            this.cts.cancel();
            this.cts.dispose();
            this.cts = null;
        }

        this.scanResult = null;

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
                this.cts = null;
            }
        }

        // #region DEBUG
        log(LogLevel.Debug, 'Re-scan done', 'Re-scan');
        // #endregion DEBUG
    }

    // #region Public



    /** Возвращает карту задач, проиндексированную по ScopeFile файла задач. */
    public getScanResult(): Readonly<ScanResult> | null {
        return this.scanResult;
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
    public static async reScan(token: vscode.CancellationToken): Promise<ScanResult> {

        const scopes = Workspace.resolveScopes();

        const { excludeFolders, pinnedRecord, pinnedConfig } = Workspace.resolveWindowSettings();

        const pinnedByFolder: Map</*scope*/string, Set<string>> = new Map();
        for (const { label, scope } of pinnedRecord) {
            let labels = pinnedByFolder.get(scope);
            if (!labels) {
                labels = new Set();
                pinnedByFolder.set(scope, labels);
            }
            labels.add(label);
        }


        const { definitionsByFile, tasksByFile } = await Tasks.fetch(scopes, token);


        return {
            tasksByFile,
            treeInput: {
                ...Workspace.buildScopeIndex(
                    scopes,
                    definitionsByFile,
                    excludeFolders,
                    pinnedByFolder
                ),
                pinnedConfig
            }
        };
    }


    /** Формирует список scope-записей из текущего workspace.
     *
     * Workspace scope (если есть) всегда первым, затем — Folder scopes.
     *
     * Для каждой папки URI указывает на файл задач (*\/tasks.json или *.code-workspace).
     * Работает как идентификатор scope — файл не обязан физически существовать на диске. */
    private static resolveScopes(): Array<TC.Scope> {

        const scopes: Array<TC.Scope> = [];

        // если есть — всегда первым
        if (vscode.workspace.workspaceFile) {
            scopes.push({
                folderName: (vscode.workspace.name ?? '<unnamed>') as TC.FolderName,
                scopeURI: vscode.workspace.workspaceFile as TC.ScopeUri
            });
        }

        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                scopes.push({
                    folderName: folder.name as TC.FolderName,
                    scopeURI: vscode.Uri.joinPath(folder.uri, ".vscode", "tasks.json") as TC.ScopeUri
                });
            }
        }

        // #region DEBUG
        log(LogLevel.Debug, 'Workspace scopes:');
        table(LogLevel.Debug, scopes.map(e => ({ Name: e.folderName, FsPath: e.scopeURI.fsPath })));
        // #endregion DEBUG

        return scopes;
    };



    private static buildScopeIndex(
        scopes: Array<TC.Scope>,
        definitionsByFile: TC.DefinitionsByFile,
        excluded: ReadonlySet</*FolderName*/string>,
        pinnedByFolder: Map</*scope*/string, Set<string>>
    ): {
        scopeIndex: Map<TC.ScopeFile, TC.ScopeRecord>;
        pinnedStales: Array<TC.PinnedStale>;
    } {

        const scopeIndex = new Map<TC.ScopeFile, TC.ScopeRecord>();
        const pinnedStales: Array<TC.PinnedStale> = [];

        for (const { folderName, scopeURI } of scopes) {

            const scopeFile = scopeURI.fsPath;

            const definitionMap = definitionsByFile.get(scopeFile);

            const pinnedSet = pinnedByFolder.get(folderName);
            const pinned: Set<TC.TaskName> = new Set();

            if (definitionMap && pinnedSet) {
                for (const pin of pinnedSet) {
                    if (definitionMap.has(pin as TC.TaskName)) {
                        pinned.add(pin as TC.TaskName);
                        pinnedSet.delete(pin);
                    }
                }
            }

            scopeIndex.set(scopeFile, {
                folderName,
                definitionMap: definitionMap ?? new Map(),
                excluded: excluded.has(folderName),
                ...Workspace.getConfig(scopeURI),
                pinned
            });

        }

        // Все что осталось в pinnedByFolder — сломано
        for (const [scopeName, staledLabels] of pinnedByFolder) {
            for (const label of staledLabels) {
                pinnedStales.push({
                    scopeName,
                    label
                });
            }
        }

        return {
            scopeIndex,
            pinnedStales
        };

    }


    private static getConfig(scopeUri: TC.ScopeUri): { treeConfig: TC.TreeConfig, nodeConfig: TC.NodeConfig; } {

        const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION, scopeUri);

        return {
            treeConfig: {
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



    /** Читает настройки уровня окна (без привязки к scope). */
    private static resolveWindowSettings(): Readonly<{
        readonly excludeFolders: Set<string>;
        readonly pinnedRecord: Array<{
            label: string;
            scope: string;
        }>;
        pinnedConfig: {
            visibility: boolean;
            smartPathCompression: boolean;
        };
    }> {


        const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION);

        const windowSettings = {
            excludeFolders: new Set(configuration.get<string[]>('filtering.excludeFolders', [])),
            pinnedRecord: configuration.get<{
                label: string;
                scope: string;
            }[]>('pinnedTasks.tasks', []),
            pinnedConfig: {
                visibility: configuration.get<boolean>('pinnedTasks.visibility', true),
                smartPathCompression: configuration.get<boolean>('pinnedTasks.smartPathCompression', true)
            }
        };

        // #region DEBUG

        log(LogLevel.Debug, 'Window settings:');
        table(LogLevel.Debug, windowSettings, { headers: ['Setting', 'Value'] });

        // #endregion DEBUG

        return windowSettings;
    }




}
