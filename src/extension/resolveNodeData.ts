import TaskNodeData from '../TreeViewPanel/TaskNodeData';

function resolveNodeData(element: object) {
    if ('data' in element && element.data != null && typeof element.data && !Array.isArray(element.data)) {
        return TaskNodeData.isTaskNodeData(element.data) ? element.data : null;
    }
    return null;
}
export default resolveNodeData;
