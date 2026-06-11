/**
 * Ручной стенд для FileDecorationProvider.
 *
 * Что проверялось:
 *  - корректность badge-логики на статическом наборе узлов,
 *    покрывающем все кейсы: r=0/a=0, r=1, r=2..9, r≥10 (overflow), только available;
 *  - смена скина через setProps + fire(undefined) обновляет все декорации разом;
 *  - вмещает ли badge emoji (> U+FFFF, суррогатная пара в UTF-16).
 *
 * Запуск: F5 → Extension Development Host, дерево появится в Explorer
 *   и будет автоматически обновляться.
 */

import * as vscode from 'vscode';
import type UriSchema from './DecorationProvider/UriSchema';
import type UriQuery from './DecorationProvider/UriQuery';
import FileDecorationProvider from './DecorationProvider/FileDecorationProvider';
import type Props from './DecorationProvider/Conf';

const logChannel = vscode.window.createOutputChannel('DecorationProvider TEST', { log: true });

// -----
// Данные
// -----

interface NodeState {
    id: string;
    label: string;
    running: number;
    available: number;
    // color?: string;
    icon?: string | undefined;
}

function makeUri(state: NodeState): vscode.Uri {
    return vscode.Uri.from({
        scheme: 'task-cockpit',
        authority: 'Node',
        path: '',
        query: new URLSearchParams({
            available: state.available.toString(),
            running: state.running.toString(),
            color: '' //state.color ?? ''
        } satisfies UriQuery).toString()
    } satisfies UriSchema);
}

// -----
// Tree
// -----

class TestItem extends vscode.TreeItem {
    constructor(public readonly state: NodeState) {
        super(state.label, vscode.TreeItemCollapsibleState.None);
        this.id = state.id;
        this.resourceUri = makeUri(state);
        // this.description = `r:${state.running}  a:${state.available}`;
        this.iconPath = state.icon ? new vscode.ThemeIcon(state.icon) : undefined;
    }
}

class TestTreeProvider implements vscode.TreeDataProvider<NodeState> {
    readonly nodes: NodeState[] = [
        { id: '1', label: 'build release',  /**/ icon: 'tools', running: 0, available: 0 },
        { id: '2', label: 'build dev',      /**/ icon: 'tools', running: 1, available: 0, }, // color: 'charts.green' },
        { id: '3', label: 'test unit',      /**/ icon: 'tools', running: 3, available: 0, }, // color: 'charts.green' },
        { id: '4', label: 'test e2e',       /**/ icon: 'tools', running: 9, available: 0, }, // color: 'charts.yellow' },
        { id: '5', label: 'lint',           /**/ icon: 'tools', running: 11, available: 0, }, // color: 'charts.orange' },
        { id: '6', label: 'watch styles',   /**/ icon: 'tools', running: 0, available: 2 },
        { id: '7', label: 'docker up',      /**/ icon: 'tools', running: 5, available: 2, }, // color: 'charts.blue' },
        { id: '8', label: 'deploy staging', /**/ icon: 'tools', running: 1, available: 0, } // color: 'charts.purple' },
    ];

    getTreeItem(node: NodeState): vscode.TreeItem { return new TestItem(node); }
    getChildren(): NodeState[] { return this.nodes; }
}

// -----
// Скины
// -----

const skins: ReadonlyArray<Props & { readonly name: string; }> = [
    { name: 'Dots', runningSymbol: '●', availableSymbol: '·', overflowSymbol: '+', badgeOrder: 'symbolFirst' },
    { name: 'Flags', runningSymbol: '⚑', availableSymbol: '⚐', overflowSymbol: '+', badgeOrder: 'symbolFirst' },
    { name: 'Rewind', runningSymbol: '▶', availableSymbol: '○', overflowSymbol: '…', badgeOrder: 'countFirst' },
    { name: 'Alert', runningSymbol: '!', availableSymbol: '~', overflowSymbol: '+', badgeOrder: 'countFirst' },
    { name: 'Stars', runningSymbol: '★', availableSymbol: '☆', overflowSymbol: '+', badgeOrder: 'symbolFirst' },
    { name: 'Toxic', runningSymbol: '😈', availableSymbol: '💤', overflowSymbol: '🤯', badgeOrder: 'symbolFirst' },
];

// -----
// activate
// -----

export function activate(context: vscode.ExtensionContext) {
    const tree = new TestTreeProvider();
    const decor = new FileDecorationProvider(skins[0]!);

    const treeView = vscode.window.createTreeView('decorationTest', { treeDataProvider: tree });
    const regDecor = vscode.window.registerFileDecorationProvider(decor);

    decor.onDidChangeFileDecorations(() => logChannel.debug('onDidChangeFileDecorations'));

    let tick = 0;
    const interval = setInterval(() => {
        tick++;
        const skin = skins[tick % skins.length]!;
        logChannel.debug(`skin → ${skin.name}`);
        decor.setConf(skin);
    }, 1500);

    context.subscriptions.push(
        treeView, regDecor, decor, logChannel,
        { dispose: () => clearInterval(interval) }
    );

    vscode.window.showInformationMessage('Decoration Test активен.');
}

export function deactivate() { }
