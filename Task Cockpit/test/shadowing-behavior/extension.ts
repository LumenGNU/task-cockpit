import * as vscode from 'vscode';
import ProjectLayout from '../../src/ResourceStateCoordinator/ResourceStructure';
import assert from 'node:assert/strict';
import groupTaskDefinitions from '../../src/ResourceStateCoordinator/TaskDefinition/groupTaskDefinitions';
import type TaskName from '../../src/TaskName';
import type Immutable from '../../src/utils/Immutable';
import OriginKey from '../../src/OriginKey';
import type TaskDefinitionMap from '../../src/ResourceStateCoordinator/TaskDefinition/TaskDefinitionMap';
import EligibleTask from '../../src/ResourceStateCoordinator/EligibleTask/EligibleTask';
import type EligibleTasksMap from '../../src/ResourceStateCoordinator/EligibleTask/EligibleTasksMap';


interface IFixture {
    taskDefinitions: Immutable<Map<OriginKey, TaskDefinitionMap>>;
    eligibleTasks: Immutable<Map<OriginKey, EligibleTasksMap>>;
    availableKeys: {
        userKey: OriginKey.GlobalKey,
        workspaceKey: OriginKey.Workspace | undefined,
        primaKey: OriginKey.Folder | undefined,
        folder2Key: OriginKey.Folder | undefined,
    };
    testedTaskName: TaskName;
}


export async function activate(context: vscode.ExtensionContext): Promise<Immutable<IFixture>> {


    const scopeLayout = ProjectLayout.getLayout();
    const [primaKey, folder2Key] = scopeLayout.folders?.map(f => f.key) ?? [undefined, undefined];

    const taskDefinitions = groupTaskDefinitions(scopeLayout);

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
            userKey: scopeLayout.global.key,
            workspaceKey: scopeLayout.workspace?.key,
            primaKey,
            folder2Key
        },
        testedTaskName: 'My Task' as TaskName
    };

}

export function deactivate(): void { }


export default IFixture;
