import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import createProjectSpace from './ProjectSpace/createProjectSpace';
import TreeDataProvider from './TreeDataProvider/TreeDataProvider';
import createGlobalConfReader from './Configuration/Global/createReader';
import GlobalConfig from './Configuration/Global/Config';
import fetchEligibleTasks from './EligibleTask/fetchEligibleTasks';
import ElementType from './TreeDataProvider/ElementType';
import ScopeKey from './Scope/Key';
import TaskName from './type.d/TaskName';
import DefinitionId from './EligibleTask/DefinitionId';
import { prepareUserProps } from './prepareUserProps';
import { readScopedPins } from './readScopedPins';


type UserProps = ReadonlyMap<ScopeKey, {
    pins: ReadonlyMap<TaskName, DefinitionId | null> | null;
}>;


const VIEW_ID = 'taskCockpit.taskTree';

const log = vscode.window.createOutputChannel('Task Cockpit DEBUG', { log: true });


export function activate(context: vscode.ExtensionContext): void {
    log.info('activate');

    const stubRegistry = {
        getProcessId() { return undefined; },
        getStats() { return undefined; },
    };

    const provider = new TreeDataProvider(stubRegistry);
    const globalConfReader = createGlobalConfReader('taskCockpit');

    context.subscriptions.push(
        log,
        vscode.window.registerTreeDataProvider(VIEW_ID, provider),


        vscode.commands.registerCommand('taskCockpit.debug.fillTree', async function () {
            const userProps = prepareUserProps(
                await readScopedPins()
            );
            await fillTree(provider, globalConfReader.read(), userProps);
        }),


        vscode.commands.registerCommand('taskCockpit.test.fillTree', async function () {
            const userProps = prepareUserProps(
                await readScopedPins()
            );
            await fillTree(provider, globalConfReader.read(), userProps);
            return await buildTreeString(provider, await Promise.resolve(provider.getChildren()), '', true);
        }),
    );
}


async function fillTree(
    provider: TreeDataProvider,
    config: GlobalConfig,
    userProps: UserProps): Promise<void> {

    const projectSpace = createProjectSpace('taskCockpit');
    const scopeMap = await projectSpace.buildSnapshot(config.ProjectSpaceConf, userProps);


    const tokenSource = new vscode.CancellationTokenSource();

    try {
        const eligibleTasks = await fetchEligibleTasks(tokenSource.token);
        provider.updateAll(scopeMap, eligibleTasks);
    } finally {
        tokenSource.dispose();
    }

}


function formatNode(type: ElementType, label: string): string {
    switch (type) {
        case ElementType.PinsSection: return `━[★[ ${label} ]]`;
        case ElementType.ScopeSection: return `━[F[ ${label} ]]`;
        case ElementType.EmptyNode: return `« ${label} »`;
        case ElementType.RunnableNode: return `▶ ${label}`;
        case ElementType.IntermediateNode: return `${label}`;
    }
}

async function buildTreeString(
    provider: TreeDataProvider,
    children: Awaited<ReturnType<TreeDataProvider['getChildren']>>,
    prefix: string,
    root = false
): Promise<string> {
    if (!children?.length) return '';

    const lines: string[] = [];
    for (let i = 0; i < children.length; i++) {
        const child = children[i]!;
        const isLast = i === children.length - 1;
        const item = await Promise.resolve(provider.getTreeItem(child));

        const rawLabel = item.label;
        const label =
            typeof rawLabel === 'string' ? rawLabel
                : rawLabel != null ? rawLabel.label
                    : String(item.id ?? '?');

        const connector = root ? '' : (isLast ? '└─ ' : '├─ ');
        const childPrefix = root ? '  ' : prefix + (isLast ? '   ' : '│  ');

        lines.push(`${prefix}${connector}${formatNode(child.type, label)}`);

        const subtree = await buildTreeString(
            provider,
            await Promise.resolve(provider.getChildren(child)),
            childPrefix
        );
        if (subtree) lines.push(subtree);
    }
    return lines.join('\n');
}

export function deactivate(): void { }
