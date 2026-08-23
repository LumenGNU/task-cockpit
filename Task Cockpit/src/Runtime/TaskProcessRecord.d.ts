import type { Terminal } from 'vscode';
import type TaskProcessId from './TaskProcessId';
import type Timestamp from './Timestamp';

interface TaskProcessRecord {
    terminalRef: WeakRef<Terminal>;
    taskProcessId: TaskProcessId;
    running: boolean;
    timestamp: Timestamp;
}

export default TaskProcessRecord;
