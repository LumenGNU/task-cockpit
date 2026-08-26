
import type {
    Uri,
} from 'vscode';
import type OriginKey from '../OriginKey';
import type TaskSource from './TaskSource';


interface UserOrigin {
    name: 'User',
    originKey: OriginKey.User;
    taskSource: null;
}

interface WorkspaceOrigin {
    name: string;
    originKey: OriginKey.Workspace;
    taskSource: TaskSource;
}

interface FolderOrigin {
    isPrimary: boolean;
    name: string;
    originKey: OriginKey.Folder;
    taskSource: TaskSource;
    uri: Uri,
}

interface ResourceStructure {
    folders: Array<FolderOrigin> | null;
    User: UserOrigin;
    Workspace: WorkspaceOrigin | null;
}



export default ResourceStructure;
