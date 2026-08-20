
import type { Uri } from 'vscode';
import type Config from './ResourceConfig/ResourceConfig';
import type Immutable from '../utils/Immutable';
import type OriginKey from '../OriginKey';
import type TaskDefinitionEntry from './TaskDefinition/TaskDefinitionEntry';
import type TaskName from '../TaskName';

interface OriginEntry {

    definitionEntries: ReadonlyArray<[taskName: TaskName, definition: Immutable<TaskDefinitionEntry>]>;
    hierarchyConfig: Config['Hierarchy'];
    name: string,
    originKey: OriginKey;
    taskSourceUri: Uri | null,
}

export default OriginEntry;
