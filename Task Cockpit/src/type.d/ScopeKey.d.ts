import type { WorkspaceKey } from '../constants';
import type { FolderKey } from './FolderKey';

/** Сериализованный ключ scope в {@linkcode PinnedStorage}.
 *
 * - Folder-scope — строковое представление ;
 *   в `.code-workspace`. (имена папок могут совпадать, URI их различает)
 * - Workspace-scope — строковое представление  */
export type ScopeKey =
    | FolderKey
    | WorkspaceKey;
