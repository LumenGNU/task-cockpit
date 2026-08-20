import type OriginEntry from './OriginEntry';


interface OriginEntriesSnapshot {

    project: Array<OriginEntry>;
    user: OriginEntry,

}


export default OriginEntriesSnapshot;
