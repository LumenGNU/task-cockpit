import type OriginEntry from './OriginEntry';


interface OriginEntriesSnapshot {

    project: Array<OriginEntry.Workspace | OriginEntry.Folder>;
    user: OriginEntry.User,

}


export default OriginEntriesSnapshot;
