import {
    type CancellationToken,
    CancellationError
} from 'vscode';
import assert from 'node:assert/strict';
import fetchDefinitions from '../Scope/TaskSource/fetchDefinitions';
import getDisplayName from '../Scope/getDisplayName';
import getKey from '../Scope/getKey';
import getSourceUri from '../Scope/getSourceUri';
import readConfig from '../Scope/readConfig';
import resolveTaskSource from '../Scope/resolveTaskSource';
import type Reader from '../Configuration/Scoped/Reader';
import type Scope from '../Scope/Scope';
import type ScopeInput from './ScopeInput';
import type Snapshot from './Snapshot';
import type Key from '../Scope/Key';

/** Собирает снимок данных по переданным областям рабочего пространства..
 *
 * Ключи результата упорядочены в соответствии с `scopes`.
 *
 *  * **Замечания:**:
 * - Порядок семантически значим — он определяет
 *   порядок при отображении в UI.
 *   Важно повторять порядок полученный от VS Code.
 *
 * Создаётся непосредственно перед построением дерева и не кэшируется
 * в этом модуле — решение о повторном использовании принимает вызывающая сторона.
 *
 * @param scopes области рабочего пространства (как правило, результат
 *   `getScopes` после применения фильтрации).
 * @param token токен отмены.
 *
 * @throws { CancellationError } при отмене через `token`.
 *  */
async function buildSnapshot(
    scopes: ReadonlyArray<Readonly<Scope>>,
    configReader: Reader,
    token: CancellationToken
): Promise<Snapshot> {

    if (token.isCancellationRequested) {
        throw new CancellationError();
    }

    const snapShot: Map<Key, ScopeInput> = new Map();

    for (const scope of scopes) {
        // заполнение StructureInput ключами в порядке из scopes
        snapShot.set(getKey(scope), Object.create(null) as ScopeInput);
    }

    await Promise.all(scopes.map(async function (scope) {

        const scopeInput = snapShot.get(getKey(scope));

        assert.ok(scopeInput);

        scopeInput.displayName = getDisplayName(scope);
        scopeInput.config = readConfig(scope, configReader);

        const sourceUri = getSourceUri(scope);
        scopeInput.sourceFile = sourceUri.fsPath;

        const taskSource = await resolveTaskSource(scope);
        scopeInput.definitions =
            taskSource
                ? await fetchDefinitions(taskSource, token)
                : new Map();

    }));

    if (token.isCancellationRequested) {
        throw new CancellationError();
    }

    return snapShot;
}


export default buildSnapshot;
