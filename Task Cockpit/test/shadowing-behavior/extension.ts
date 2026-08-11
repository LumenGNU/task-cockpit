import * as vscode from 'vscode';
import ScopeLayout from '../../src/ResourceState/ScopeLayout';
import assert from 'node:assert/strict';
import mapTaskDefinitions from '../../src/ResourceState/TaskDefinition/mapTaskDefinitions';
import type TaskName from '../../src/TaskName';
import type Immutable from '../../src/utils/Immutable';
import ScopeKey from '../../src/ScopeKey';
import type TaskDefinitionMap from '../../src/TaskDefinitionMap';
import EligibleTask from '../../src/EligibleTask';
import type EligibleTasksMap from '../../src/EligibleTasksMap';


interface IFixture {
    taskDefinitions: Immutable<Map<ScopeKey, TaskDefinitionMap>>;
    eligibleTasks: Immutable<Map<ScopeKey, EligibleTasksMap>>;
    availableKeys: {
        userKey: ScopeKey.GlobalKey,
        workspaceKey: ScopeKey.WorkspaceKey | undefined,
        primaKey: ScopeKey.FolderKey | undefined,
        folder2Key: ScopeKey.FolderKey | undefined,
    };
    testedTaskName: TaskName;
}


export async function activate(context: vscode.ExtensionContext): Promise<Immutable<IFixture>> {


    const scopeLayout = ScopeLayout.getLayout();
    const [primaKey, folder2Key] = scopeLayout.folderScopes?.map(f => f.key) ?? [undefined, undefined];

    const taskDefinitions = mapTaskDefinitions(scopeLayout);

    const fetchedTasks = await vscode.tasks.fetchTasks();

    const eligibleTasks = EligibleTask.mapEligibleTasks(fetchedTasks, taskDefinitions);

    // console.log(
    //     JSON.stringify(eligibleTasks, (_, v) => v instanceof Map ? Object.fromEntries(v) : v)
    // );
    // process.exit(100);

    return {
        taskDefinitions,
        eligibleTasks,
        availableKeys: {
            userKey: scopeLayout.globalScope.key,
            workspaceKey: scopeLayout.workspaceScope?.key,
            primaKey,
            folder2Key
        },
        testedTaskName: 'My Task' as TaskName
    };

}

export function deactivate(): void { }


export default IFixture;
