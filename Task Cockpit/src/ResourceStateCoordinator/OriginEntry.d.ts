
import type Config from './ResourceConfig/ResourceConfig';
import type OriginKey from '../OriginKey';
import type TaskDefinitionEntry from './TaskDefinition/TaskDefinitionEntry';
import type TaskName from '../TaskName';
import type TaskSource from './TaskSource';


type OriginEntry =
    | OriginEntry.User
    | OriginEntry.Workspace
    | OriginEntry.Folder;


declare namespace OriginEntry {

    interface User {
        originKey: OriginKey.User;
        definitionEntries: ReadonlyArray<[taskName: TaskName, definition: TaskDefinitionEntry]>;
        hierarchyConfig: Config['Hierarchy'];
        name: string,
        taskSource: null,
    }


    interface Workspace {
        originKey: OriginKey.Workspace;
        definitionEntries: ReadonlyArray<[taskName: TaskName, definition: TaskDefinitionEntry]>;
        hierarchyConfig: Config['Hierarchy'];
        name: string,
        taskSource: TaskSource;
    }


    interface Folder {
        originKey: OriginKey.Folder;
        definitionEntries: ReadonlyArray<[taskName: TaskName, definition: TaskDefinitionEntry]>;
        hierarchyConfig: Config['Hierarchy'];
        name: string,
        taskSource: TaskSource,
        isPrima: boolean;
    }

}

export default OriginEntry;
