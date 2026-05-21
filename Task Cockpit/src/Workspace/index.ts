/** @file Workspace/index.ts */
/** @module Workspace */

import {
    TaskScope,
    workspace as VscWorkspace,
    type CancellationToken,
    CancellationError
} from 'vscode';
import Scope from './Scope';
import type StructureInput from './StructureInput';
import ScopedConfig from './ScopedConfig';
import assert from 'node:assert/strict';


declare namespace Workspace {

    export type Definition = import('./Definition').default;
    export type Scope = import('./Scope').default;
    export type ScopedConfig = import('./ScopedConfig').default;

}

/** Адаптер над VS Code workspace API, предоставляющий структуру
 *  рабочего пространства в терминах областей-источников задач.
 *
 * Отвечает за:
 * - Какие области рабочего пространства структурно присутствуют — {@link Workspace#getScopes}.
 * - Какие данные соответствуют этим областям — {@link Workspace#buildStructureInput}.
 *
 * Данные, не актор: не принимает решений о фильтрации или отображении.
 * */
const Workspace = {

    /** Готовит объект к работе и возвращает его:
     *
     * - {@link ScopedConfig.init | валидирует схему конфигурации}.
     *
     * @param section имя секции для чтения конфигурации VS Code,
     *   передаётся в {@linkcode ScopedConfig.init}.
     *  */
    init(section: string) {

        const configReader = ScopedConfig.init(section);

        return {

            /** Возвращает области рабочего пространства, структурно присутствующие в проекте.
             *
             * Структурный факт — без учёта пользовательских настроек фильтрации.
             * Policy-решения применяются выше, до передачи результата в {@link buildStructureInput}.
             *
             * **Инвариант:** `TaskScope.Workspace`, если присутствует — всегда первый.
             * */
            getScopes(): ReadonlyArray<Readonly<Workspace.Scope>> {
                return [
                    ...(VscWorkspace.workspaceFile ? [TaskScope.Workspace] as const : []),
                    ...(VscWorkspace.workspaceFolders ?? []),
                ] as const;
            },


            /** Собирает снимок данных по переданным областям рабочего пространства..
             *
             * Ключи объекта-результата упорядочены в соответствии с `scopes`.
             *
             *  * **Замечания:**:
             * - Порядок семантически значим — он определяет
             *   порядок при отображении в UI.
             *   Важно повторять порядок полученный от VS Code.
             *
             * @param scopes области рабочего пространства (как правило, результат
             *   `getScopes` после применения фильтрации).
             * @param token токен отмены.
             *
             * @throws { CancellationError } при отмене через `token`.
             *  */
            async buildStructureInput(
                scopes: ReadonlyArray<Readonly<Workspace.Scope>>,
                token: CancellationToken
            ): Promise<StructureInput> {

                if (token.isCancellationRequested) {
                    throw new CancellationError();
                }

                const StructureInput = Object.create(null) as StructureInput;
                for (const scope of scopes) {
                    // заполнение StructureInput ключами в порядке из scopes
                    StructureInput[Scope.getKey(scope)] = Object.create(null) as StructureInput.ScopeInput;
                }

                await Promise.all(scopes.map(async (scope) => {

                    const scopeInput = StructureInput[Scope.getKey(scope)];

                    assert.ok(scopeInput);

                    scopeInput.scope = scope;
                    scopeInput.config = Scope.getScopedConfig(scope, configReader);
                    scopeInput.definitions = await Scope.fetchDefinition(scope, token);

                }));

                return StructureInput;

            }


        } as const;
    },

    Scope,


} as const;


export default Workspace;
