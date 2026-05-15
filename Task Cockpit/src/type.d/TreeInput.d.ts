import type * as vscode from 'vscode';
import type { ScopeKey } from '../Scope/ScopeKey';
import type { PinnedConfig } from './PinnedConfig';
import type { PinnedStale } from './PinnedStale';


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
    /** Данные всех scope. */
    scopeIndex: Record<ScopeKey, vscode.TaskScope.Workspace | vscode.WorkspaceFolder>;
    /** {@linkcode PinnedConfig} — Конфигурация раздела закреплённых задач. */
    pinnedConfig: PinnedConfig;
    /** {@linkcode PinnedStale}`[]` — Записи, scope которых больше не существует в workspace. */
    pinnedStales: Array<PinnedStale>;
}
