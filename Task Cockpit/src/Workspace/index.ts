/** @file Cockpit/Workspace/index.ts */
/** @module Workspace */


import * as vscode from 'vscode';
import Tasks from './Tasks';
import type * as TC from '../types';


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from '../Logger';
const { log, table } = Logger.get(module.filename);
// #endregion DEBUG

// @todo
interface WorkspaceState {
    tasksRecord: Record<TC.TaskId, vscode.Task>;
}

interface RevocablePromise<T> {
    promise: Promise<T>;
    revoke: () => void;
}


/** Производное представление рабочей области проекта.
 *
 * Отражает структуру workspace (папки, определения задач) и настройки
 * расширения. Состояние не хранится, а вычисляется по запросу из текущей
 * конфигурации VS Code.
 *
 * При изменении входных данных (конфигурация, в т.ч. задачи; состав папок)
 * **уведомляет** подписчиков через {@linkcode onDidChange} и инвалидирует
 * закэшированный результат. Пересчёт происходит лениво — при следующем
 * вызове {@linkcode getState}.
 *
 * Валидный результат хранится между вызовами и **протухает по бездействию**:
 * если к нему не обращаются в течение idle-TTL, он освобождается и при
 * следующем запросе будет вычислен заново. Каждое обращение к действующему
 * состоянию перезапускает отсчёт.
 *
 * Мотивация: {@linkcode WorkspaceState} удерживает отфильтрованный набор
 * `vscode.Task`-объектов, собранных на момент вычисления. Сам VS Code их
 * постоянно не кэширует — фетчит через `vscode.tasks.fetchTasks` по запросу.
 * Расширение может простаивать длительное время между запусками задач;
 * idle-TTL нужен, чтобы в такие периоды выборка не удерживалась в памяти
 * без пользы. 
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
    readonly onDidChange = this.onDidChangeEvent.event;

    // таймер протухания
    private idleTimer: NodeJS.Timeout | null = null;
    private static readonly IDLE_TTL_MS = 666_000; // 11,1 минут

    private static readonly CONFIG_SECTION = 'taskCockpit';

    private subscriptions: vscode.Disposable;

    private revocablePromise: RevocablePromise<WorkspaceState> | null = null;

    private disposed = false;

    constructor() {

        this.subscriptions = vscode.Disposable.from(

            vscode.workspace.onDidChangeWorkspaceFolders(() => this.notify()),
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration(Workspace.CONFIG_SECTION) || e.affectsConfiguration('tasks')) {
                    this.notify();
                }
            }),

            this.onDidChangeEvent
        );
    }

    private notify() {
        // таймер существует только для текущего revocablePromise, 
        // при смене состояния таймер гасится вместе с ним
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        if (this.revocablePromise) {
            this.revocablePromise.revoke();
            this.revocablePromise = null;
        }
        this.onDidChangeEvent.fire();
    }

    private scheduleIdleEviction(owner: Promise<WorkspaceState>): void {

        // не трогаем чужое состояние
        if (this.revocablePromise?.promise !== owner) {
            return; // состояние успели заменить
        }

        // перезапуск таймера
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }

        this.idleTimer = setTimeout(() => {
            // если таймер дотикал...
            this.idleTimer = null;
            if (this.revocablePromise?.promise === owner) {
                this.revocablePromise = null; // ...состояние "протухло"
            }
        }, Workspace.IDLE_TTL_MS);
    }


    public getState(): Promise<WorkspaceState> {

        if (this.disposed) {
            throw new Error('Workspace disposed');
        }

        // "текущее состояние воркспейса", а не "кэш результата вычисления".
        // Rejected-промис — это тоже валидное состояние: "воркспейс сейчас 
        // нечитаем|не актуален". 
        // Пока не пришло событие об изменении входных данных — состояние не 
        // изменилось, rejected оно или fulfilled.
        // Если состоянием никто не интересуется — {@link rescan | оно протухает}
        const revocablePromise = this.revocablePromise;
        if (!revocablePromise) {
            return this.rescan();
        }
        // idleTimer !== null ⟺ promise уже settled (fulfilled) — можно продлить TTL.
        // Pending: таймер взведётся сам, когда .then в rescan() дотикает до scheduleIdleEviction.
        // Rejected: таймер не взводится вовсе — состояние живёт до notify().
        // - Pending (compute ещё работает): TTL не продлеваем. "время бездействия" не идёт, 
        //   пока идёт активная работа. Первое взведение таймера произойдёт в .then из rescan(),
        //   когда compute закончится.
        // - Fulfilled: каждый getState() перезапускает TTL → refresh-on-access.
        // - Rejected: idleTimer === null, refresh не делаем, состояние живёт до notify() — 
        //   потому что "Само оно не починится".
        if (this.idleTimer) {
            this.scheduleIdleEviction(revocablePromise.promise);
        }
        return revocablePromise.promise;
    }

    /** Находит задачу по идентификатору в валидном состоянии рабочей области.
     *
     * В отличие от {@linkcode getState}, метод не пробрасывает наружу промежуточные
     * rejected-состояния: rejected ≡ состояние инвалидировано через {@linkcode notify}
     * во время вычисления, и метод автоматически повторяет запрос следующего
     * состояния. Возврат происходит только после проверки **валидного**
     * (fulfilled) состояния — либо когда становится понятно, что валидного
     * состояния больше не будет.
     *
     * Ответ `null` означает одно из двух:
     * - задача с таким `id` отсутствует в проверенном валидном состоянии;
     * - {@linkcode Workspace} диспоснут и валидного состояния уже не будет.
     *
     * С точки зрения вызывающего оба случая эквивалентны: ответа по задаче
     * не будет.
     *
     * Метод не отменяется извне: ожидание валидного
     * состояния ограничено только сроком жизни самого {@linkcode Workspace}.
     * Количество итераций равно числу событий {@linkcode notify}, прилетевших
     * подряд во время работы метода — busy-loop исключён, каждая итерация
     * подвешивается на новый `compute()`.
     *
     * @affects Попадание в валидное состояние также продлевает его TTL через штатный
     * механизм {@linkcode getState} (refresh-on-access).
     *
     * @param id Идентификатор задачи.
     * @returns Найденная задача либо `null`. */
    public async getTaskById(id: TC.TaskId): Promise<vscode.Task | null> {

        // null: либо задачи нет в валидном состоянии, либо Workspace диспоснут
        // (валидного состояния уже не будет)
        while (!this.disposed) {
            try {
                const { tasksRecord } = await this.getState();
                return tasksRecord[id] ?? null;
            }
            catch {
                // rejected ≡ CancellationError по контракту runCancellable:
                // revoke() вызывается только из notify(), который перед этим
                // обнуляет revocablePromise. Следующий getState() пойдёт в
                // rescan() за свежим состоянием — busy-loop исключён,
                // каждая итерация ждёт новый compute().

                // @note Ситуация "compute бросил TypeError → все повыснет"
                // чинится не здесь, а в `compute`!
                continue;
            }
        }

        return null;
    }

    private rescan(): Promise<WorkspaceState> {

        const { promise }
            = this.revocablePromise
            = runCancellable(compute);

        promise.then(
            () => this.scheduleIdleEviction(promise),
            () => {
                // rejected ≡ CancellationError по контракту runCancellable.
                // Rejected-состояние не протухает по бездействию: единственный
                // способ выйти из него — notify() от внешнего события.
                // Само оно не починится, таймер не взводим.
            }
        );

        return promise;
    }


    dispose(): void {

        this.disposed = true;

        this.subscriptions.dispose();

        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }

        this.revocablePromise?.revoke();
        this.revocablePromise = null;
    }
}


/** Вычисляет состояние рабочей области из наблюдаемого через VS Code API.
 *
 * Чистая функция от текущего снимка конфигурации и папок workspace.
 *
 * На любой невалидный или нечитаемый ввод (битый `tasks.json`, отсутствие
 * ожидаемых полей и т.п.) возвращает штатный результат с редуцированным
 * содержимым — вплоть до пустого {@linkcode WorkspaceState}. Исключения
 * не бросает (см. контракт {@linkcode runCancellable} и границы
 * ответственности в jsdoc {@linkcode Workspace}): чинить источник
 * не её ответственность. 
 * 
 * @note
 * Код, к которому нельзя подступиться через контракт, — это код, которого 
 * в контракте нет. А значит, его не должно быть и в реализации.
 * Весь rejected-контур в rescan/getState/getTaskById — ровно такой. 
 * Чтобы протестировать ветку «не-CancellationError», нужен compute, который 
 * бросает не-CancellationError, — то есть compute, нарушающий свой же контракт. 
 * Валидного сценария, в котором эта ветка срабатывает, не существует по построению.
 * 
 * */
async function compute(token: vscode.CancellationToken): Promise<WorkspaceState> {
    // TBD
    // @todo
    return {
        tasksRecord: {}
    };
}


/** Запускает {@linkcode worker} с возможностью отмены извне.
 *
 * Возвращает {@linkcode RevocablePromise}: промис с результатом {@linkcode worker}
 * и функцию `revoke()` для отмены. Вызов `revoke()` переводит промис
 * в rejected-состояние с {@linkcode vscode.CancellationError}, независимо от того,
 * успел ли `worker` отреагировать на отмену через переданный токен.
 *
 * @param worker Функция, выполняющая работу. Получает
 * {@linkcode vscode.CancellationToken} для кооперативной отмены.
 *
 * Ожидается поведение в стиле {@linkcode vscode.Thenable}-API самого VS Code:
 * - при отмене (`token.onCancellationRequested`) — прервать работу
 *   и отклонить промис через {@linkcode vscode.CancellationError};
 * - при "настоящей" ошибке (сбой в логике, недоступные данные и т.п.) —
 *   **не бросать исключение**, а завершиться штатно с "пустым" значением типа `T`
 *   (например, `undefined`, `null`, пустой массив/объект — в зависимости
 *   от контракта `T`). Бросать следует только `CancellationError`.
 * 
 * Сигнатура `(token) => Promise<T>` подразумевает возврат Promise.
 * Синхронный throw из `worker` (до возврата Promise) — нарушение сигнатуры,
 * утилита от него не страхуется: оборачивать вызов в
 * `Promise.resolve().then(() => worker(token))` означало бы защищаться
 * от бага в самом `worker`-е в рантайме потребителя. Такие вещи лечатся
 * в `worker`-е, их место — ревью и тесты.  Оборачивать такое в try/catch 
 * или в Promise.resolve().then(worker) — значит платить сложностью 
 * потребителя за баг поставщика и делать этот баг молчаливым. Контракт нарушен —
 * чинится нарушитель, а не потребитель.
 *
 * Соблюдение контракта со стороны `worker` делает rejected-состояние
 * возвращённого промиса однозначным индикатором отмены.
 *
 * Нарушение контракта (rejected не-`CancellationError`) — баг `worker`-а.
 * Утилита от этого не защищается: ошибка пролетает насквозь в reject
 * возвращённого промиса. Диагностика такого — ревью и тесты, не рантайм.
 *
 * @returns { RevocablePromise<T> } с результатом `worker` и функцией отмены. */
function runCancellable<T>(
    worker: (token: vscode.CancellationToken) => Promise<T>,
): RevocablePromise<T> {

    const cts = new vscode.CancellationTokenSource();

    const promise = new Promise<T>((resolve, reject) => {

        let cancelSub: vscode.Disposable | null = cts.token.onCancellationRequested(() => {
            reject(new vscode.CancellationError());
            if (cancelSub) {
                cancelSub.dispose();
                cancelSub = null;
            }
        });

        // либо worker завершится, либо сработает cancelSub выше
        worker(cts.token)
            .then(resolve, (error) => {
                if (error instanceof vscode.CancellationError) {
                    reject(error);
                    return;
                }
                // #region DEBUG
                const workerName = worker.name || '<anonymous>';
                const detail = error instanceof Error
                    ? `${error.name}: ${error.message}\n${error.stack ?? '(no stack)'}`
                    : `(non-Error) ${String(error)}`;
                log(LogLevel.Error, `worker '${workerName}' rejected with non-CancellationError (contract violation): ${detail}`, 'runCancellable');
                // #endregion DEBUG
                reject(error);
            })
            .finally(() => {
                if (cancelSub) {
                    cancelSub.dispose();
                    cancelSub = null;
                }
                cts.dispose();
            });
    });

    return {
        promise,
        revoke: () => cts.cancel(),
    };
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


//     /** Формирует список scope-записей из текущего workspace.
//      *
//      * Workspace scope (если есть) всегда первым, затем — Folder scopes.
//      *
//      * Для каждой папки URI указывает на файл задач (*\/tasks.json или *.code-workspace).
//      * Работает как идентификатор scope — файл не обязан физически существовать на диске. */
//     private static resolveScopes(): Array<TC.Scope> {

//         const scopes: Array<TC.Scope> = [];

//         // если есть — всегда первым
//         if (vscode.workspace.workspaceFile) {
//             scopes.push({
//                 folderName: (vscode.workspace.name ?? '<unnamed>') as TC.FolderName,
//                 scopeURI: vscode.workspace.workspaceFile as TC.ScopeUri
//             });
//         }

//         if (vscode.workspace.workspaceFolders) {
//             for (const folder of vscode.workspace.workspaceFolders) {
//                 scopes.push({
//                     folderName: folder.name as TC.FolderName,
//                     scopeURI: vscode.Uri.joinPath(folder.uri, ".vscode", "tasks.json") as TC.ScopeUri
//                 });
//             }
//         }

//         // #region DEBUG
//         log(LogLevel.Debug, 'Workspace scopes:');
//         table(LogLevel.Debug, scopes.map(e => ({ Name: e.folderName, FsPath: e.scopeURI.fsPath })));
//         // #endregion DEBUG

//         return scopes;
//     };



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


//     private static getConfig(scopeUri: TC.ScopeUri): { treeConfig: TC.TreeConfig, nodeConfig: TC.NodeConfig; } {

//         const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION, scopeUri);

//         return {
//             treeConfig: {
//                 segmentSeparator: configuration.get<string>('display.segmentSeparator') || false as const,
//                 showHidden: configuration.get<boolean>('filtering.showHidden', false),
//                 useGroupKind: configuration.get<boolean>('display.useGroupKind', false)
//             },
//             nodeConfig: {
//                 defaultIconName: configuration.get<string>('display.defaultIconName', 'tools'),
//                 tintLabel: configuration.get<boolean>('display.tintLabel', false),
//                 useFolderIcon: configuration.get<boolean>('display.useFolderIcon', false)
//             }
//         };

//     }



//     /** Читает настройки уровня окна (без привязки к scope). */
//     private static resolveWindowSettings(): Readonly<{
//         readonly excludeFolders: Set<string>;
//         readonly pinnedRecord: Array<{
//             label: string;
//             scope: string;
//         }>;
//         pinnedConfig: {
//             visibility: boolean;
//             smartPathCompression: boolean;
//         };
//     }> {


//         const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION);

//         const windowSettings = {
//             excludeFolders: new Set(configuration.get<string[]>('filtering.excludeFolders', [])),
//             pinnedRecord: configuration.get<{
//                 label: string;
//                 scope: string;
//             }[]>('pinnedTasks.tasks', []),
//             pinnedConfig: {
//                 visibility: configuration.get<boolean>('pinnedTasks.visibility', true),
//                 smartPathCompression: configuration.get<boolean>('pinnedTasks.smartPathCompression', true)
//             }
//         };

//         // #region DEBUG

//         log(LogLevel.Debug, 'Window settings:');
//         table(LogLevel.Debug, windowSettings, { headers: ['Setting', 'Value'] });

//         // #endregion DEBUG

//         return windowSettings;
//     }

// }
