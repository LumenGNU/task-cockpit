import TaskName from 'src/type.d/TaskName';
import DefinitionId from 'src/EligibleTask/DefinitionId';
import ScopeKey from 'src/Scope/Key';


type UserProps = ReadonlyMap<ScopeKey, {
    pins: ReadonlyMap<TaskName, DefinitionId | null> | null;
}>;


function prepareUserProps(
    scopedPins: Array<{ scopeKey: ScopeKey; pinnedTasks: TaskName[]; }>,
): UserProps {
    const result = new Map<ScopeKey, {
        pins: Map<TaskName, DefinitionId | null> | null;
    }>();

    const getOrCreate = (key: ScopeKey) => {
        let entry = result.get(key);
        if (entry === undefined) {
            entry = {
                pins: null,
                // state: null
            };
            result.set(key, entry);
        }
        return entry;
    };

    for (const { scopeKey, pinnedTasks } of scopedPins) {
        getOrCreate(scopeKey).pins = new Map(pinnedTasks.map(name => [name, null]));
    }

    return result;
}


export {
    prepareUserProps
};


export type {
    UserProps
};
