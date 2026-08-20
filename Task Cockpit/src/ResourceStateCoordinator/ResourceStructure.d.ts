
import type {
    Uri,
} from 'vscode';
import type OriginKey from '../OriginKey';
import type TaskSource from './TaskSource';


interface UserOrigin {
    name: 'User',
    originKey: OriginKey.UserKey;
    taskSource: null;
}

interface WorkspaceOrigin {
    name: string;
    originKey: OriginKey.WorkspaceKey;
    taskSource: TaskSource;
}

interface FolderOrigin {
    isPrima: boolean;
    name: string;
    originKey: OriginKey.FolderKey;
    taskSource: TaskSource;
    uri: Uri,
}

interface ResourceStructure {
    folders: Array<FolderOrigin> | null;
    User: UserOrigin;
    Workspace: WorkspaceOrigin | null;
}



export default ResourceStructure;
