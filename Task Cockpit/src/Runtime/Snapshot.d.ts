import type { Terminal } from 'vscode';
import type ProcessId from './ProcessId';
import type Timestamp from './Timestamp';

interface Snapshot {
    terminalRef: WeakRef<Terminal>;
    processId: ProcessId;
    running: boolean;
    timestamp: Timestamp;
}

export default Snapshot;
