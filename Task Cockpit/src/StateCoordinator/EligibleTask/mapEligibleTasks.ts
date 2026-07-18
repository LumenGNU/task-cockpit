import isEligibleTask from './isEligibleTask';
import getScopeKey from '../../Scope/getKey';

import {
    type Task as VscTask
} from 'vscode';
import type ScopeKey from '../../Scope/Key';
import type TaskName from '../../TaskName/TaskName';
import type EligibleTask from './EligibleTask';


function mapEligibleTasks(fetched: ReadonlyArray<Readonly<VscTask>>): Map<ScopeKey, Map<TaskName, EligibleTask>> {
    return fetched.reduce(function (map, task) {
        if (isEligibleTask(task)) {
            // Отобрать "подходящие" задачи и проиндексировать по
            // идентификаторам (ScopeKey, TaskName),
            // пропуская "не подходящие"

            const scopeKey = getScopeKey(task.scope);

            let taskMap = map.get(scopeKey);
            if (!taskMap) {
                taskMap = new Map();
                map.set(scopeKey, taskMap);
            }
            taskMap.set(task.name, task);
        }
        // else {
        //     // @todo trace log
        // }
        return map;
    }, new Map<ScopeKey, Map<TaskName, EligibleTask>>());
}

export default mapEligibleTasks;
