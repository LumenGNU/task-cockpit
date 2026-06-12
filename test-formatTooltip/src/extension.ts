/**
 * Отладочное расширение для ручной визуальной проверки `formatTooltip`.
 *
 * Поведение `MarkdownString` в hover-тултипе не очевидно из кода —
 * рендерер VS Code может по-своему обрабатывать leading whitespace,
 * `BR`, `P` и пустые параграфы. Единственный способ убедиться
 * что разделители выглядят как задумано — посмотреть глазами.
 *
 * Запуск: открыть в Extension Development Host, навести на элементы
 * в панели Explorer → «Tooltip Test».
 */


import * as vscode from 'vscode';
import formatTooltip from './TreeView/formatTooltip';


const CASES: ReadonlyArray<{
    treeLabel: string;
    title: string | null;
    label: string | null;
    detail: string | null;
}> = [
        { treeLabel: 'all three (T + L + D)', title: 'Title text', label: 'Label text', detail: 'Detail text goes here' },
        { treeLabel: 'title + label (T + L)', title: 'Title text', label: 'Label text', detail: null },
        { treeLabel: 'title + detail (T + D)', title: 'Title text', label: null, detail: 'Detail text goes here' },
        { treeLabel: 'label + detail (L + D)', title: null, label: 'Label text', detail: 'Detail text goes here' },
        { treeLabel: 'title only (T)', title: 'Title text', label: null, detail: null },
        { treeLabel: 'label only (L)', title: null, label: 'Label text', detail: null },
        { treeLabel: 'detail only (D)', title: null, label: null, detail: 'Detail text goes here' },
        // проверяем что функция возвращает undefined, а не пустой MarkdownString
        // vscode покажет тултип по умолчанию
        { treeLabel: 'all null → undef', title: null, label: null, detail: null },
    ];

function createProvider(): vscode.TreeDataProvider<vscode.TreeItem> {
    const items = CASES.map(c => {
        const item = new vscode.TreeItem(c.treeLabel, vscode.TreeItemCollapsibleState.None);
        item.tooltip = formatTooltip(c.title, c.label, c.detail);
        return item;
    });

    return {
        getTreeItem: (el) => el,
        getChildren: () => items,
    };
}

export function activate(context: vscode.ExtensionContext): void {
    const view = vscode.window.createTreeView('tooltipTest', {
        treeDataProvider: createProvider(),
    });
    context.subscriptions.push(view);
}

export function deactivate(): void { }
