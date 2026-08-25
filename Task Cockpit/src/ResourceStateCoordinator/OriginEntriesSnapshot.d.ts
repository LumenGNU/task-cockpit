import type OriginEntry from './OriginEntry';


interface OriginEntriesSnapshot {
    User: OriginEntry.User;
    Workspace: OriginEntry.Workspace | null;
    folders: Array<OriginEntry.Folder>;
}


export default OriginEntriesSnapshot;
