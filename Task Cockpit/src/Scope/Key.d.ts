
import type FolderKey from './Folder/Key';
import type WorkspaceKey from './Workspace/Key';
import type GlobalKey from './Global/Key';

/** Сериализуемый строковый идентификатор области-источника задач */
type Key =
    | GlobalKey
    | FolderKey
    | WorkspaceKey;


export default Key;
