import type ScopeKey from '../Scope/Key';
import type TaskName from '../type.d/TaskName';

interface TaskIdentifier {
    scopeKey: ScopeKey;
    taskName: TaskName;
}

export default TaskIdentifier;
