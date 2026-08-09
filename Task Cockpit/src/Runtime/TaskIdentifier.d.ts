import type ScopeKey from '../ScopeKey';
import type TaskName from '../TaskName';

interface TaskIdentifier {
    scopeKey: ScopeKey;
    taskName: TaskName;
}

export default TaskIdentifier;
