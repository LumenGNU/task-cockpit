
import type FolderKey from './Folder/Key';
import type WorkspaceKey from './Workspace/Key';


/** Сериализуемый строковый идентификатор области-источника задач */
type Key =
    | FolderKey
    | WorkspaceKey;


export default Key;
