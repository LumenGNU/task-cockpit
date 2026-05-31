import {
    WorkspaceFolder
} from 'vscode';
import type Uri from './Uri';


type Folder = Omit<WorkspaceFolder, 'uri'> & {
    readonly uri: Uri;
};

export default Folder;
