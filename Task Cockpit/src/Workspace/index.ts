/** @file Cockpit/Workspace/index.ts */
/** @module Workspace */


import * as vscode from 'vscode';
import type * as TC from '../types';
import Definitions from './Scopes/Definitions';
import TaskIndexCache from './TaskIndexCache';




// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log, table } = Logger.get(module.filename);
// #endregion DEBUG


/** Ссылка на закреплённую задачу: scope + имя задачи. */
export interface FavoriteRef {
    scope: Scope;
    label: TC.TaskName;
}


/** Настройки уровня окна — общие для всего workspace, не зависят от scope.
 * НЕ связанные с валидацией
*/
export interface WindowSettings { // @todo имя не подходит
    /** Имена папок workspace, исключённых из отображения. */
    readonly excludeFolders: Set<string>;
    readonly pinnedRecord: Array<{
        label: string;
        scope: string;
    }>;
    pinnedConfig: PinnedConfig;
    // /** Скрывать ли задачи, определённые на уровне workspace (`.code-workspace`). */
    // readonly excludeWorkspaceTasks: boolean;
    // /** Настройки валидации задач. */
    // readonly validationSettings: ValidationSettings; // @todo не должно быть тут
}





/** Конфигурация раздела закреплённых задач. */
export interface PinnedConfig {
    /** Режим видимости раздела. False — безусловно скрыт. */
    visibility: boolean;
    /** Поведение сжатия узлов в разделе. */
    smartPathCompression: boolean;
}



/** Устаревшая запись закреплённой задачи, scope которой больше не существует. */
export interface PinnedStale {
    scopeName: string;
    label: string;
}

/** Входные данные для построения дерева задач.
 *
 * Ограничения на данные:
 *
 * **Замечания:**:
 * - Порядок scopeIndex семантически значим — он определяет
 *   порядок File-секций в выводе, и порядок PinnedFolder-обёрток внутри PinnedMulti.
 *
 * **Предусловия**:
 * - Все `ScopeRecord.folderName` уникальны среди всех ScopeRecord.
 * - Каждое имя из `ScopeRecord.pinned` присутствует как ключ
 *   в том же `ScopeRecord.definitionMap`.
 * */
export interface TreeInput {
    /** `Map<`{@linkcode ScopeFile}`, `{@linkcode ScopeRecord}`>` —
     * Данные всех scope, индексированные по файлу задач. */
    scopeIndex: Map<TC.ScopeFile, ScopeRecord>;
    /** {@linkcode PinnedConfig} — Конфигурация раздела закреплённых задач. */
    pinnedConfig: PinnedConfig;
    /** {@linkcode PinnedStale}`[]` — Записи, scope которых больше не существует в workspace. */
    pinnedStales: Array<PinnedStale>;
}

/** Данные одного scope для построения дерева:
 * определения задач, конфигурация отображения и набор закреплённых имён. */
export interface ScopeRecord {
    /**  */
    scope: Scope;
    /** Папка workspace, исключена из отображения */
    excluded: boolean;
    /** Определения задач scope, индексированные по имени. */
    definitions: Definitions;
    /** {@linkcode TreeConfig} — Конфигурация структуры ветки дерева для этого scope. */
    treeConfig: ScopedSettings.TreeConfig;
    /** {@linkcode NodeConfig} — Конфигурация визуального отображения узлов для этого scope. */
    nodeConfig: ScopedSettings.NodeConfig;
    /** Имена закреплённых задач этого scope. */
    pinned: Set<TC.TaskName>;
}

// @todo
interface WorkspaceState {
    scopeRecord: ScopeRecord;
}



// interface TaskIndexCache {
//     rPromise: RevocablePromise<Readonly<TaskIndex.Index>> | null;
//     idleTimer: NodeJS.Timeout | null;
// }



/** Производное представление рабочей области проекта.
 *
 * Отражает структуру workspace (папки, определения задач) и настройки
 * расширения. Состояние не хранится, а вычисляется по запросу из текущей
 * конфигурации VS Code.
 *
 * При изменении входных данных (конфигурация, в т.ч. задачи; состав папок)
 * **уведомляет** подписчиков через {@linkcode onDidChange} и инвалидирует
 * закэшированный индекс задач.
 *
 * **Границы ответственности.** Код не обслуживает состояние — только отражает
 * его. Корректность содержимого рабочей области (валидность `tasks.json`,
 * консистентность конфигурации, наличие ожидаемых файлов и папок) остаётся
 * на совести VS Code и пользователя. У кода нет права и причин что-либо
 * «исправлять» в ФС или конфигурации; на невалидный вход реакция одна —
 * отразить это как штатный результат (пустой/редуцированный T), а не пытаться
 * починить источник. Работаем с тем, что дают. */
export default class Workspace implements vscode.Disposable {

    private readonly onDidChangeEvent = new vscode.EventEmitter<void>();
    public readonly onDidChange = this.onDidChangeEvent.event;

    // таймер протухания
    private static readonly IDLE_TTL_MS = 666_000; // 11,1 минут

    private static readonly CONFIG_SECTION = 'taskCockpit';

    private readonly subscriptions: vscode.Disposable;


    private readonly taskIndexCache: TaskIndexCache;

    private disposed = false;

    constructor() {

        this.taskIndexCache = new TaskIndexCache(Workspace.IDLE_TTL_MS);

        this.subscriptions = vscode.Disposable.from(

            vscode.workspace.onDidChangeWorkspaceFolders(() => this.notify()),
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration(Workspace.CONFIG_SECTION) || e.affectsConfiguration('tasks')) {
                    this.notify();
                }
            }),

            this.onDidChangeEvent,
            this.taskIndexCache
        );
    }


    public dispose(): void {

        this.disposed = true;

        this.subscriptions.dispose();

    }

    public async getTaskById(id: TC.TaskId): Promise<Readonly<vscode.Task> | null> {
        return (await this.taskIndexCache.get())[id] ?? null;
    }


    private notify() {

        this.taskIndexCache.update();

        this.onDidChangeEvent.fire();
    }















}















// interface ScanResult { tasksByFile: TC.TasksByFile, treeInput: TC.TreeInput; }


// const CONFIG_SECTION = "taskCockpit";



// export default class Workspace implements vscode.Disposable {

//     private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();

//     /** Срабатывает при изменении структуры workspace, настроек расширения
//      * или определений задач.
//      *
//      * Сигнал о безусловной перестройки дерева. */
//     public readonly onDidChange = this.onDidChangeEmitter.event;

//     /** CTS текущего активного скана. Отменяется при запуске нового скана или при dispose. */
//     private cts: vscode.CancellationTokenSource | null = null;

//     /** Составной Disposable для единого освобождения ресурсов экземпляра. */
//     private readonly disposable: vscode.Disposable;



//     /** Инициализирует новый экземпляр класса {@linkcode Workspace}.
//      *
//      * Автоматически подписывается на следующие события:
//      * - {@linkcode vscode.workspace.onDidChangeConfiguration}
//      * - {@linkcode vscode.workspace.onDidChangeWorkspaceFolders}
//      *
//      * При возникновении событий **не перестраивает** состояние самостоятельно —
//      * только уведомляет подписчиков через {@linkcode onDidChange}.
//      * Перестройка происходит при вызове {@linkcode reScan}. */
//     private constructor() {

//         this.disposable = vscode.Disposable.from(
//             vscode.workspace.onDidChangeConfiguration(this.configurationChange_Handler, this),
//             vscode.workspace.onDidChangeWorkspaceFolders(this.workspaceFoldersChange_Handler, this),
//             this.onDidChangeEmitter
//         );
//     }



//     /** Освобождает все ресурсы, зарегистрированные при инициализации {@linkcode Workspace}. */
//     public dispose(): void {

//         this.disposable.dispose();

//         if (this.cts) {
//             this.cts.cancel();
//             this.cts.dispose();
//             this.cts = null;
//         }

//         // #region DEBUG
//         log(LogLevel.Debug, 'Disposed', 'dispose');
//         // #endregion DEBUG
//     }


//     public async getSnapshot(): Promise<ScanResult> {

//         let dry = false;
//         let spapshot = null;

//         this.onDidChange(() => dry = true);

//         do {
//             dry = false;
//             spapshot = await this._getSnapshot();
//         } while (dry);

//         return spapshot;
//     }



//     /** @throws {vscode.CancellationError} */
//     private async _getSnapshot(): Promise<ScanResult> {

//         // #region DEBUG
//         log(LogLevel.Debug, 'Re-scan started ...', 'Re-scan');
//         // #endregion DEBUG

//         this.cts?.cancel();
//         this.cts?.dispose();
//         const cts = new vscode.CancellationTokenSource();
//         this.cts = cts;

//         try {

//             const scanResult = await Workspace.reScan(this.cts.token);

//             // #region DEBUG
//             log(LogLevel.Debug, 'Re-scan done', 'Re-scan');
//             // #endregion DEBUG
//             return scanResult;
//         }
//         catch (error) {
//             if (!(error instanceof vscode.CancellationError)) {
//                 vscode.window.showErrorMessage(`Internal error: Failed to re-scan workspace: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
//             }

//             // #region DEBUG
//             log(LogLevel.Debug, 'Re-scan canceled, aborting', 'Re-scan');
//             // #endregion DEBUG

//             throw error;
//         }
//         finally {
//             if (this.cts === cts) {
//                 this.cts = null;
//             }
//         }


//     }

//     // #region Public



//     // #endregion Public


//     // #region _Handlers


//     /** Обработчик изменения состава папок workspace.
//      *
//      * Уведомляет подписчиков о изменении.
//      *
//      * Не изменяет состояние. */
//     private workspaceFoldersChange_Handler(_e: vscode.WorkspaceFoldersChangeEvent) {

//         // #region DEBUG
//         log(LogLevel.Debug, 'Handler invoked', 'onDidChangeWorkspaceFolders');
//         log(LogLevel.Debug, 'Firing onDidChange', 'onDidChangeWorkspaceFolders');
//         // #endregion DEBUG

//         this.onDidChangeEmitter.fire();
//     }


//     /** Обработчик изменения конфигурации.
//      *
//      * Реагирует на изменения в секциях `taskCockpit` и `tasks` и уведомляет подписчиков.
//      *
//      * Не изменяет внутреннее состояние. */
//     private configurationChange_Handler(e: vscode.ConfigurationChangeEvent) {

//         // #region DEBUG
//         log(LogLevel.Debug, 'Handler invoked', 'onDidChangeConfiguration');
//         // #endregion DEBUG

//         const settingsChanged = e.affectsConfiguration(CONFIG_SECTION);
//         const tasksChanged = e.affectsConfiguration('tasks');

//         if (!settingsChanged && !tasksChanged) {

//             // #region DEBUG
//             log(LogLevel.Debug,
//                 `No relevant "${CONFIG_SECTION}" config or "tasks" changes, skipping`, 'onDidChangeConfiguration');
//             // #endregion DEBUG

//             return;
//         }

//         // #region DEBUG
//         log(LogLevel.Debug, 'Firing onDidChange', 'onDidChangeConfiguration');
//         // #endregion DEBUG

//         this.onDidChangeEmitter.fire();
//     }

//     // #endregion _Handlers


//     /** Перестраивает всё внутреннее состояние: scope-записи, resource- и window-настройки,
//      * и карту задач.
//      *
//      * Вызывается при инициализации и при любом релевантном изменении.
//      *
//      * @throws {vscode.CancellationError} */
//     public static async reScan(token: vscode.CancellationToken): Promise<ScanResult> {

//         const scopes = Workspace.resolveScopes();

//         const { excludeFolders, pinnedRecord, pinnedConfig } = Workspace.resolveWindowSettings();

//         const pinnedByFolder: Map</*scope*/string, Set<string>> = new Map();
//         for (const { label, scope } of pinnedRecord) {
//             let labels = pinnedByFolder.get(scope);
//             if (!labels) {
//                 labels = new Set();
//                 pinnedByFolder.set(scope, labels);
//             }
//             labels.add(label);
//         }


//         const { definitionsByFile, tasksByFile } = await Tasks.fetch(scopes, token);


//         return {
//             tasksByFile,
//             treeInput: {
//                 ...Workspace.buildScopeIndex(
//                     scopes,
//                     definitionsByFile,
//                     excludeFolders,
//                     pinnedByFolder
//                 ),
//                 pinnedConfig
//             }
//         };
//     }






//     private static buildScopeIndex(
//         scopes: Array<TC.Scope>,
//         definitionsByFile: TC.DefinitionsByFile,
//         excluded: ReadonlySet</*FolderName*/string>,
//         pinnedByFolder: Map</*scope*/string, Set<string>>
//     ): {
//         scopeIndex: Map<TC.ScopeFile, TC.ScopeRecord>;
//         pinnedStales: Array<TC.PinnedStale>;
//     } {

//         const scopeIndex = new Map<TC.ScopeFile, TC.ScopeRecord>();
//         const pinnedStales: Array<TC.PinnedStale> = [];

//         for (const { folderName, scopeURI } of scopes) {

//             const scopeFile = scopeURI.fsPath;

//             const definitionMap = definitionsByFile.get(scopeFile);

//             const pinnedSet = pinnedByFolder.get(folderName);
//             const pinned: Set<TC.TaskName> = new Set();

//             if (definitionMap && pinnedSet) {
//                 for (const pin of pinnedSet) {
//                     if (definitionMap.has(pin as TC.TaskName)) {
//                         pinned.add(pin as TC.TaskName);
//                         pinnedSet.delete(pin);
//                     }
//                 }
//             }

//             scopeIndex.set(scopeFile, {
//                 folderName,
//                 definitionMap: definitionMap ?? new Map(),
//                 excluded: excluded.has(folderName),
//                 ...Workspace.getConfig(scopeURI),
//                 pinned
//             });

//         }

//         // Все что осталось в pinnedByFolder — сломано
//         for (const [scopeName, staledLabels] of pinnedByFolder) {
//             for (const label of staledLabels) {
//                 pinnedStales.push({
//                     scopeName,
//                     label
//                 });
//             }
//         }

//         return {
//             scopeIndex,
//             pinnedStales
//         };

//     }
