/** @file Cockpit/index.ts */
/** @module Cockpit */


// #region DEBUG
import { LogLevel } from 'vscode';
import Logger from './Logger';
const { log, assert } = Logger.get(module.filename);
// #endregion DEBUG


import * as vscode from 'vscode';
import TaskCache from './TaskIndex/TaskCache';
import { ConfigSectionName } from './constants';
import type { ProjectSettings } from './Settings/ProjectConfiguration';
import type { ScopedSettings } from './Settings/ScopedConfiguration';
import ProjectConfiguration from './Settings/ProjectConfiguration';
import ScopedConfiguration from './Settings/ScopedConfiguration';
import Scope from './Scope';
import { TaskId } from './type.d/TaskId';
import type EligibleTask from './EligibleTask';
import Runtime from './Runtime';
import { ScopeKey } from './type.d/ScopeKey';


/** Производное представление рабочей области проекта.
 *
 * Отражает структуру workspace (папки, определения задач) и настройки
 * расширения. Состояние не хранится, а вычисляется по запросу из текущей
 * конфигурации VS Code.
 *
 * При изменении входных данных (конфигурация, в т.ч. задачи; состав папок)
 * **уведомляет** подписчиков через {@linkcode onHasEvolved} и инвалидирует
 * закэшированный индекс задач.
 *
 * **Границы ответственности.** Код не обслуживает состояние — только отражает
 * его. Корректность содержимого рабочей области (валидность `tasks.json`,
 * консистентность конфигурации, наличие ожидаемых файлов и папок) остаётся
 * на совести VS Code и пользователя. У кода нет права и причин что-либо
 * «исправлять» в ФС или конфигурации; на невалидный вход реакция одна —
 * отразить это как штатный результат (пустой/редуцированный T), а не пытаться
 * починить источник. Работаем с тем, что дают. */
class Project implements vscode.Disposable {



    private readonly onHasEvolvedEmitter = new vscode.EventEmitter<void>();
    public readonly onHasEvolved = this.onHasEvolvedEmitter.event;


    readonly #subscriptions: vscode.Disposable;


    #taskCache: TaskCache;

    #disposed = false;

    #projectConfiguration: ReturnType<typeof ProjectConfiguration['init']>;
    #scopedConfiguration: ReturnType<typeof ScopedConfiguration['init']>;

    #projectSettings: ProjectSettings;


    #scopes: {
        scopeRecord: Record<ScopeKey, Scope>;
        total: number;
        hidden: number;
    };


    #runtime: Runtime;


    constructor() {

        this.#projectConfiguration = ProjectConfiguration.init(ConfigSectionName);
        this.#scopedConfiguration = ScopedConfiguration.init(ConfigSectionName);

        // ---


        this.#projectSettings = this.#projectConfiguration.read();
        this.#taskCache = new TaskCache(this.#projectSettings.cockpit.cacheIdleTTL);
        this.#scopes = this.#scopesUpdate(this.#projectSettings.filtering.excludeFolders);

        this.#runtime = new Runtime(this.#projectSettings.cockpit);

        this.#subscriptions = vscode.Disposable.from(

            // vscode.workspace.onDidChangeWorkspaceFolders(() => this.#update()),
            // vscode.workspace.onDidChangeConfiguration((e) => {
            //     if (e.affectsConfiguration(ConfigSectionName) || e.affectsConfiguration('tasks')) {
            //         this.#update();
            //     }
            // }),

            this.onHasEvolvedEmitter,
            this.#taskCache
        );
    }


    public dispose(): void {

        this.#disposed = true;

        this.#subscriptions.dispose();

    }

    // #region PublicAPI


    public getScopes() {
        return this.#scopes;
    }


    public async getTaskIndex() {
        return await this.#taskCache.get();
    }


    public getRuntime() {
        return this.#runtime;
    }

    // #endregion PublicAPI


    toEvolved() {

        this.#projectSettings = this.#projectConfiguration.read();

        this.#taskCache.update(this.#projectSettings.cockpit.cacheIdleTTL);
        this.#scopes = this.#scopesUpdate(this.#projectSettings.filtering.excludeFolders);

        this.onHasEvolvedEmitter.fire();
    }


    #scopesUpdate(
        excludeFolders: Set<string>
    ): {
        scopeRecord: Record<ScopeKey, Scope>;
        total: number;
        hidden: number;
    } {

        const scopeRecord = Object.create(null) as Record<ScopeKey, Scope>;

        const scopeList = Scope.List.get();
        const total = scopeList.length;

        let hidden = 0;

        for (const scope of scopeList) {
            if (excludeFolders.has(Scope.displayName(scope))) {
                ++hidden;
                continue;
            }
            scopeRecord[Scope.getKey(scope)] = scope;
        }

        return {
            scopeRecord,
            total,
            hidden
        };
    }


}


namespace Project {

}

export default Project;
